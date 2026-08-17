-- =============================================================================
-- Migration: Speaker Honorarium & Tax Compliance Ledger
-- Description: Adds external payees, their tax documentation state and the
--              honorarium payments made to them. Payments are keyed on the
--              payee rather than the club so that year-to-date earnings can be
--              totalled across every club that booked the same speaker.
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payee_residency_status') THEN
        CREATE TYPE public.payee_residency_status AS ENUM (
            'domestic',
            'foreign_treaty',
            'foreign_non_treaty'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payee_tax_form_type') THEN
        CREATE TYPE public.payee_tax_form_type AS ENUM ('w9', 'w8ben', 'none');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'honorarium_payment_status') THEN
        CREATE TYPE public.honorarium_payment_status AS ENUM (
            'draft',
            'approved',
            'paid',
            'cancelled'
        );
    END IF;
END$$;

-- 1. Payees ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.honorarium_payees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT,
    residency public.payee_residency_status NOT NULL DEFAULT 'domestic',
    form_type public.payee_tax_form_type NOT NULL DEFAULT 'none',
    form_signed_on DATE,
    -- Only meaningful for treaty payees; percent, not a fraction.
    treaty_rate_percent NUMERIC(5, 2),
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT honorarium_payees_form_dated CHECK (
        form_type = 'none' OR form_signed_on IS NOT NULL
    ),
    CONSTRAINT honorarium_payees_treaty_rate_range CHECK (
        treaty_rate_percent IS NULL OR treaty_rate_percent BETWEEN 0 AND 100
    )
);

CREATE INDEX IF NOT EXISTS idx_honorarium_payees_name
    ON public.honorarium_payees (lower(full_name));

-- 2. Payments ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.honorarium_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payee_id UUID NOT NULL REFERENCES public.honorarium_payees(id) ON DELETE RESTRICT,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    -- Integer minor units. Never store honorarium amounts as floats.
    gross_cents BIGINT NOT NULL,
    engagement_date DATE NOT NULL,
    status public.honorarium_payment_status NOT NULL DEFAULT 'draft',
    -- Cached at release time so the ledger keeps what was actually withheld,
    -- even if the payee later updates their paperwork.
    withheld_cents BIGINT,
    released_at TIMESTAMPTZ,
    released_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT honorarium_payments_gross_positive CHECK (gross_cents >= 0),
    CONSTRAINT honorarium_payments_withheld_range CHECK (
        withheld_cents IS NULL OR (withheld_cents >= 0 AND withheld_cents <= gross_cents)
    )
);

CREATE INDEX IF NOT EXISTS idx_honorarium_payments_payee_year
    ON public.honorarium_payments (payee_id, engagement_date);

CREATE INDEX IF NOT EXISTS idx_honorarium_payments_club
    ON public.honorarium_payments (club_id, engagement_date DESC);

-- 3. Year-to-date helper -----------------------------------------------------
--
-- The reporting threshold is a per-payee, per-year figure that spans clubs, so
-- it cannot be answered from a single club's ledger.
CREATE OR REPLACE FUNCTION public.payee_ytd_gross_cents(
    p_payee_id UUID,
    p_tax_year INT
)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(SUM(gross_cents), 0)::BIGINT
    FROM public.honorarium_payments
    WHERE payee_id = p_payee_id
      AND status <> 'cancelled'
      AND EXTRACT(YEAR FROM engagement_date) = p_tax_year;
$$;

GRANT EXECUTE ON FUNCTION public.payee_ytd_gross_cents(UUID, INT) TO authenticated;

-- 4. Row level security ------------------------------------------------------

ALTER TABLE public.honorarium_payees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.honorarium_payments ENABLE ROW LEVEL SECURITY;

-- Payee records carry tax documentation state, so they are only visible to
-- officers of a club that has booked or is booking the payee.
DROP POLICY IF EXISTS "Officers view payees they book" ON public.honorarium_payees;
CREATE POLICY "Officers view payees they book"
ON public.honorarium_payees FOR SELECT
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM public.honorarium_payments hp
        WHERE hp.payee_id = honorarium_payees.id
          AND public.is_club_admin(hp.club_id, auth.uid())
    )
);

DROP POLICY IF EXISTS "Officers create payees" ON public.honorarium_payees;
CREATE POLICY "Officers create payees"
ON public.honorarium_payees FOR INSERT
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Officers update payees they book" ON public.honorarium_payees;
CREATE POLICY "Officers update payees they book"
ON public.honorarium_payees FOR UPDATE
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM public.honorarium_payments hp
        WHERE hp.payee_id = honorarium_payees.id
          AND public.is_club_admin(hp.club_id, auth.uid())
    )
);

DROP POLICY IF EXISTS "Officers view club honorariums" ON public.honorarium_payments;
CREATE POLICY "Officers view club honorariums"
ON public.honorarium_payments FOR SELECT
USING (public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Officers manage club honorariums" ON public.honorarium_payments;
CREATE POLICY "Officers manage club honorariums"
ON public.honorarium_payments FOR ALL
USING (public.is_club_admin(club_id, auth.uid()))
WITH CHECK (public.is_club_admin(club_id, auth.uid()));

-- 5. Keep updated_at honest --------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_honorarium_payee()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_honorarium_payee ON public.honorarium_payees;
CREATE TRIGGER trg_touch_honorarium_payee
BEFORE UPDATE ON public.honorarium_payees
FOR EACH ROW
EXECUTE FUNCTION public.touch_honorarium_payee();
