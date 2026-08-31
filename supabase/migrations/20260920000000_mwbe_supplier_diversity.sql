-- Migration for Automated "Club Spending" Corporate Tax ID Scraper (Supplier Diversity Tracking) (#5291)
--
-- Stores the result of querying the state's official MWBE directory during vendor
-- onboarding, and exposes the released-escrow aggregate the federal grant's 15%
-- minority/women-owned spend mandate is measured against.

-- One row per vendor lookup against the state directory.
CREATE TABLE IF NOT EXISTS public.mwbe_vendor_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Federal EIN, XX-XXXXXXX. The taxpayer identity, not the trading name:
    -- two businesses can share a name, but an EIN identifies one filer.
    vendor_ein VARCHAR(11) NOT NULL UNIQUE CHECK (vendor_ein ~ '^[0-9]{2}-[0-9]{7}$'),
    vendor_legal_name TEXT NOT NULL,
    status VARCHAR(16) NOT NULL
        CHECK (status IN ('VERIFIED', 'EXPIRED', 'NOT_FOUND', 'INVALID_EIN')),
    category VARCHAR(24)
        CHECK (category IN ('MINORITY_OWNED', 'WOMEN_OWNED', 'MINORITY_WOMEN_OWNED', 'DISADVANTAGED')),
    certificate_number TEXT,
    issuing_registry TEXT,
    expires_on DATE,
    match_method VARCHAR(12) NOT NULL CHECK (match_method IN ('EIN', 'LEGAL_NAME', 'NONE')),
    -- Sentence an auditor can read: why this badge was granted or withheld.
    evidence TEXT NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A VERIFIED badge must carry the certificate that backs it and an expiry,
    -- so nothing can be counted toward the mandate on an unsourced claim.
    CONSTRAINT mwbe_verified_requires_certificate CHECK (
        status <> 'VERIFIED'
        OR (certificate_number IS NOT NULL AND category IS NOT NULL AND expires_on IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_mwbe_certifications_status
    ON public.mwbe_vendor_certifications (status);
CREATE INDEX IF NOT EXISTS idx_mwbe_certifications_legal_name
    ON public.mwbe_vendor_certifications (lower(vendor_legal_name));

-- vendor_contracts identifies vendors by trading name only, which cannot be
-- matched to a directory record reliably. Onboarding now records the EIN so spend
-- can be attributed to the certified taxpayer instead of a string.
ALTER TABLE public.vendor_contracts
    ADD COLUMN IF NOT EXISTS vendor_ein VARCHAR(11);

COMMENT ON COLUMN public.vendor_contracts.vendor_ein IS
    'Federal EIN captured at onboarding, used to attribute escrow payouts to an MWBE certification (#5291).';

/**
 * Released escrow payouts tagged with the vendor's certification.
 *
 * Only released contracts appear: contracted-but-unpaid money would let the
 * university report compliance on spending it has not made, which is the first
 * thing a grant audit tests. Rows join on EIN when onboarding captured one and
 * fall back to the normalized legal name for contracts predating that column.
 */
CREATE OR REPLACE VIEW public.mwbe_escrow_payouts AS
SELECT
    vc.id AS contract_id,
    vc.club_id,
    vc.vendor_name,
    vc.vendor_ein,
    vc.amount AS amount_usd,
    vc.released_at,
    cert.id AS certification_id,
    cert.category,
    cert.certificate_number,
    cert.expires_on,
    -- Expired certificates do not count: the badge has to be in force on the day
    -- the money moved, not merely have existed at some point.
    COALESCE(
        cert.status = 'VERIFIED' AND (cert.expires_on IS NULL OR cert.expires_on >= vc.released_at::date),
        FALSE
    ) AS mwbe_certified
FROM public.vendor_contracts vc
LEFT JOIN public.mwbe_vendor_certifications cert
    ON (vc.vendor_ein IS NOT NULL AND cert.vendor_ein = vc.vendor_ein)
    OR (vc.vendor_ein IS NULL AND lower(cert.vendor_legal_name) = lower(vc.vendor_name))
WHERE vc.released_at IS NOT NULL
  AND vc.amount > 0;

/** Campus-wide totals for the Super Admin compliance dashboard. */
CREATE OR REPLACE VIEW public.mwbe_compliance_summary AS
SELECT
    COALESCE(SUM(amount_usd), 0) AS total_spend_usd,
    COALESCE(SUM(amount_usd) FILTER (WHERE mwbe_certified), 0) AS mwbe_spend_usd,
    CASE
        WHEN COALESCE(SUM(amount_usd), 0) = 0 THEN 0
        ELSE ROUND(
            (COALESCE(SUM(amount_usd) FILTER (WHERE mwbe_certified), 0) / SUM(amount_usd)) * 100,
            1
        )
    END AS mwbe_percent,
    COUNT(*) AS payout_count,
    COUNT(*) FILTER (WHERE mwbe_certified) AS mwbe_payout_count
FROM public.mwbe_escrow_payouts;

-- RLS -------------------------------------------------------------------------

ALTER TABLE public.mwbe_vendor_certifications ENABLE ROW LEVEL SECURITY;

-- Certification status is what organizers see as a badge and what boosts search,
-- so it is readable by any authenticated user.
CREATE POLICY "MWBE certifications are readable by authenticated users"
ON public.mwbe_vendor_certifications
FOR SELECT TO authenticated USING (TRUE);

-- No INSERT, UPDATE or DELETE policy is granted to any client role. Rows are
-- written only by the verify-mwbe-certification Edge Function using the service
-- role, so a vendor cannot award itself a badge the state never issued.
