-- Migration: 20261116000000_vendor_insurance_compliance.sql
-- Description: Issue #3397 - Vendor Certificate of Insurance compliance gate
--
-- event_vendors (20260830000000_create_vendor_marketplace) can be moved to
-- APPROVED with no evidence that the vendor carries any insurance at all.
-- This adds the evidence, the requirements to test it against, and a trigger
-- that refuses the approval when it does not hold.

-- 1. Requirements by risk category.
--    Kept as data rather than hardcoded because these figures are institutional
--    policy, not physics: a campus with a different risk appetite changes rows
--    here instead of changing code. Mirrors CATEGORY_REQUIREMENTS in
--    src/lib/vendorInsurance.ts.
CREATE TABLE IF NOT EXISTS public.vendor_insurance_requirements (
    category TEXT NOT NULL CHECK (
        category IN (
            'PHOTOGRAPHY_MEDIA', 'PERFORMER', 'EQUIPMENT_RENTAL',
            'CATERING_COLD', 'CATERING_HOT_FOOD', 'FOOD_TRUCK_PROPANE',
            'AMUSEMENT_INFLATABLE', 'ALCOHOL_SERVICE'
        )
    ),
    coverage_line TEXT NOT NULL CHECK (
        coverage_line IN (
            'GENERAL_LIABILITY', 'AUTO_LIABILITY', 'WORKERS_COMP',
            'LIQUOR_LIABILITY', 'UMBRELLA_EXCESS'
        )
    ),
    minimum_limit BIGINT NOT NULL CHECK (minimum_limit > 0),
    PRIMARY KEY (category, coverage_line),
    -- An umbrella is a way of meeting a limit, never a limit in its own right.
    CONSTRAINT vendor_requirement_not_umbrella CHECK (coverage_line <> 'UMBRELLA_EXCESS')
);

INSERT INTO public.vendor_insurance_requirements (category, coverage_line, minimum_limit)
VALUES
    ('PHOTOGRAPHY_MEDIA',    'GENERAL_LIABILITY', 1000000),
    ('PERFORMER',            'GENERAL_LIABILITY', 1000000),
    ('EQUIPMENT_RENTAL',     'GENERAL_LIABILITY', 1000000),
    ('EQUIPMENT_RENTAL',     'AUTO_LIABILITY',    1000000),
    ('CATERING_COLD',        'GENERAL_LIABILITY', 1000000),
    ('CATERING_COLD',        'AUTO_LIABILITY',     500000),
    ('CATERING_HOT_FOOD',    'GENERAL_LIABILITY', 2000000),
    ('CATERING_HOT_FOOD',    'AUTO_LIABILITY',    1000000),
    ('CATERING_HOT_FOOD',    'WORKERS_COMP',       500000),
    ('FOOD_TRUCK_PROPANE',   'GENERAL_LIABILITY', 2000000),
    ('FOOD_TRUCK_PROPANE',   'AUTO_LIABILITY',    1000000),
    ('FOOD_TRUCK_PROPANE',   'WORKERS_COMP',       500000),
    ('AMUSEMENT_INFLATABLE', 'GENERAL_LIABILITY', 5000000),
    ('AMUSEMENT_INFLATABLE', 'AUTO_LIABILITY',    1000000),
    ('AMUSEMENT_INFLATABLE', 'WORKERS_COMP',       500000),
    ('ALCOHOL_SERVICE',      'GENERAL_LIABILITY', 2000000),
    ('ALCOHOL_SERVICE',      'LIQUOR_LIABILITY',  2000000)
ON CONFLICT (category, coverage_line) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.vendor_insurance_required_endorsements (
    category TEXT NOT NULL,
    endorsement TEXT NOT NULL CHECK (
        endorsement IN ('ADDITIONAL_INSURED', 'WAIVER_OF_SUBROGATION', 'PRIMARY_NON_CONTRIBUTORY')
    ),
    PRIMARY KEY (category, endorsement)
);

INSERT INTO public.vendor_insurance_required_endorsements (category, endorsement)
VALUES
    ('PHOTOGRAPHY_MEDIA',    'ADDITIONAL_INSURED'),
    ('PERFORMER',            'ADDITIONAL_INSURED'),
    ('EQUIPMENT_RENTAL',     'ADDITIONAL_INSURED'),
    ('EQUIPMENT_RENTAL',     'WAIVER_OF_SUBROGATION'),
    ('CATERING_COLD',        'ADDITIONAL_INSURED'),
    ('CATERING_HOT_FOOD',    'ADDITIONAL_INSURED'),
    ('CATERING_HOT_FOOD',    'WAIVER_OF_SUBROGATION'),
    ('FOOD_TRUCK_PROPANE',   'ADDITIONAL_INSURED'),
    ('FOOD_TRUCK_PROPANE',   'WAIVER_OF_SUBROGATION'),
    ('AMUSEMENT_INFLATABLE', 'ADDITIONAL_INSURED'),
    ('AMUSEMENT_INFLATABLE', 'WAIVER_OF_SUBROGATION'),
    ('AMUSEMENT_INFLATABLE', 'PRIMARY_NON_CONTRIBUTORY'),
    ('ALCOHOL_SERVICE',      'ADDITIONAL_INSURED'),
    ('ALCOHOL_SERVICE',      'PRIMARY_NON_CONTRIBUTORY')
ON CONFLICT (category, endorsement) DO NOTHING;

-- 2. What the vendor is actually doing. A caterer who also runs the bar is two
--    categories and must be held to the higher of each line, so this is a
--    many-to-many rather than a column.
CREATE TABLE IF NOT EXISTS public.event_vendor_categories (
    vendor_id UUID NOT NULL REFERENCES public.event_vendors(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    PRIMARY KEY (vendor_id, category)
);

-- 3. The certificate.
CREATE TABLE IF NOT EXISTS public.vendor_insurance_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.event_vendors(id) ON DELETE CASCADE,
    issuer TEXT NOT NULL,
    policy_number TEXT NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_until TIMESTAMPTZ NOT NULL,
    -- Endorsements are facts recorded from the certificate, never inferred
    -- from the limits. Absent means absent, and absent fails closed.
    additional_insured BOOLEAN NOT NULL DEFAULT FALSE,
    waiver_of_subrogation BOOLEAN NOT NULL DEFAULT FALSE,
    primary_non_contributory BOOLEAN NOT NULL DEFAULT FALSE,
    document_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT vendor_certificate_period CHECK (effective_until > effective_from)
);

CREATE INDEX IF NOT EXISTS idx_vendor_certificate_vendor
    ON public.vendor_insurance_certificates (vendor_id);

-- Drives the renewal chase: certificates approved months ahead of an event
-- lapse in between, and nobody re-reads a PDF they already accepted.
CREATE INDEX IF NOT EXISTS idx_vendor_certificate_expiry
    ON public.vendor_insurance_certificates (effective_until);

-- 4. Limits, one row per line. Relational rather than JSONB so a shortfall can
--    be found with a join instead of being recomputed in application code.
CREATE TABLE IF NOT EXISTS public.vendor_insurance_coverage (
    certificate_id UUID NOT NULL REFERENCES public.vendor_insurance_certificates(id) ON DELETE CASCADE,
    coverage_line TEXT NOT NULL CHECK (
        coverage_line IN (
            'GENERAL_LIABILITY', 'AUTO_LIABILITY', 'WORKERS_COMP',
            'LIQUOR_LIABILITY', 'UMBRELLA_EXCESS'
        )
    ),
    limit_amount BIGINT NOT NULL CHECK (limit_amount >= 0),
    PRIMARY KEY (certificate_id, coverage_line)
);

-- 5. Append-only verification log. After an incident the question is not what
--    the requirements are now, but what was checked at the moment this vendor
--    was approved and by whom.
CREATE TABLE IF NOT EXISTS public.vendor_insurance_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_id UUID REFERENCES public.vendor_insurance_certificates(id) ON DELETE SET NULL,
    vendor_id UUID NOT NULL REFERENCES public.event_vendors(id) ON DELETE CASCADE,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome TEXT NOT NULL CHECK (
        outcome IN (
            'COMPLIANT', 'NO_CERTIFICATE', 'EXPIRED', 'NOT_YET_EFFECTIVE',
            'LAPSES_BEFORE_EVENT', 'INSUFFICIENT_COVERAGE', 'MISSING_ENDORSEMENT'
        )
    ),
    -- The requirements in force at the time, so a later policy change does not
    -- rewrite what this decision was made against.
    requirements_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_vendor_verification_vendor
    ON public.vendor_insurance_verifications (vendor_id, verified_at DESC);

-- 6. Coverage available per line once an excess policy is applied.
--
--    An umbrella sits above an underlying policy, so it tops up a line that
--    already has cover and cannot conjure cover on a line that has none.
--    Workers' compensation is statutory and deliberately excluded.
CREATE OR REPLACE FUNCTION public.vendor_effective_coverage(
    p_certificate_id UUID,
    p_line TEXT
)
RETURNS BIGINT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT
        primary_limit
        + CASE
            WHEN primary_limit > 0
                 AND p_line IN ('GENERAL_LIABILITY', 'AUTO_LIABILITY', 'LIQUOR_LIABILITY')
            THEN umbrella_limit
            ELSE 0
          END
    FROM (
        SELECT
            COALESCE((
                SELECT c.limit_amount FROM public.vendor_insurance_coverage c
                WHERE c.certificate_id = p_certificate_id AND c.coverage_line = p_line
            ), 0) AS primary_limit,
            COALESCE((
                SELECT c.limit_amount FROM public.vendor_insurance_coverage c
                WHERE c.certificate_id = p_certificate_id AND c.coverage_line = 'UMBRELLA_EXCESS'
            ), 0) AS umbrella_limit
    ) AS limits;
$$;

-- 7. Every line this vendor falls short on, with the exact gap.
--
--    "Insufficient coverage" is not something a student officer can act on.
--    "Auto liability is $500,000 and a food truck needs $1,000,000" is.
CREATE OR REPLACE FUNCTION public.vendor_coverage_shortfalls(p_vendor_id UUID)
RETURNS TABLE (
    coverage_line TEXT,
    required_limit BIGINT,
    provided_limit BIGINT,
    shortfall BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    WITH required AS (
        SELECT r.coverage_line, MAX(r.minimum_limit) AS required_limit
        FROM public.event_vendor_categories vc
        JOIN public.vendor_insurance_requirements r ON r.category = vc.category
        WHERE vc.vendor_id = p_vendor_id
        GROUP BY r.coverage_line
    ),
    latest AS (
        SELECT c.id
        FROM public.vendor_insurance_certificates c
        WHERE c.vendor_id = p_vendor_id
        ORDER BY c.effective_until DESC
        LIMIT 1
    )
    SELECT
        req.coverage_line,
        req.required_limit,
        COALESCE(public.vendor_effective_coverage((SELECT id FROM latest), req.coverage_line), 0),
        GREATEST(
            0,
            req.required_limit
                - COALESCE(public.vendor_effective_coverage((SELECT id FROM latest), req.coverage_line), 0)
        )
    FROM required req
    WHERE req.required_limit >
          COALESCE(public.vendor_effective_coverage((SELECT id FROM latest), req.coverage_line), 0)
    ORDER BY req.coverage_line;
$$;

-- 8. Whether the vendor may be confirmed for its event.
--
--    The policy period is tested against the *operational* window, widened by
--    load-in and teardown, not the published event hours. A certificate that
--    lapses at midnight on the event day does not cover the 6am teardown.
CREATE OR REPLACE FUNCTION public.vendor_insurance_status(
    p_vendor_id UUID,
    p_load_in_hours INTEGER DEFAULT 12,
    p_teardown_hours INTEGER DEFAULT 12
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_cert RECORD;
    v_window_from TIMESTAMPTZ;
    v_window_to TIMESTAMPTZ;
    v_missing INTEGER;
BEGIN
    SELECT e.start_date - MAKE_INTERVAL(hours => p_load_in_hours),
           COALESCE(e.end_date, e.start_date) + MAKE_INTERVAL(hours => p_teardown_hours)
    INTO v_window_from, v_window_to
    FROM public.event_vendors v
    JOIN public.events e ON e.id = v.event_id
    WHERE v.id = p_vendor_id;

    SELECT * INTO v_cert
    FROM public.vendor_insurance_certificates c
    WHERE c.vendor_id = p_vendor_id
    ORDER BY c.effective_until DESC
    LIMIT 1;

    IF v_cert IS NULL THEN
        RETURN 'NO_CERTIFICATE';
    END IF;

    IF v_cert.effective_until <= NOW() THEN
        RETURN 'EXPIRED';
    END IF;

    IF v_window_from IS NOT NULL AND v_cert.effective_from > v_window_from THEN
        RETURN 'NOT_YET_EFFECTIVE';
    END IF;

    IF v_window_to IS NOT NULL AND v_cert.effective_until < v_window_to THEN
        RETURN 'LAPSES_BEFORE_EVENT';
    END IF;

    IF EXISTS (SELECT 1 FROM public.vendor_coverage_shortfalls(p_vendor_id)) THEN
        RETURN 'INSUFFICIENT_COVERAGE';
    END IF;

    SELECT COUNT(*) INTO v_missing
    FROM public.event_vendor_categories vc
    JOIN public.vendor_insurance_required_endorsements e ON e.category = vc.category
    WHERE vc.vendor_id = p_vendor_id
      AND NOT (
          (e.endorsement = 'ADDITIONAL_INSURED'       AND v_cert.additional_insured)
       OR (e.endorsement = 'WAIVER_OF_SUBROGATION'    AND v_cert.waiver_of_subrogation)
       OR (e.endorsement = 'PRIMARY_NON_CONTRIBUTORY' AND v_cert.primary_non_contributory)
      );

    IF v_missing > 0 THEN
        RETURN 'MISSING_ENDORSEMENT';
    END IF;

    RETURN 'COMPLIANT';
END;
$$;

-- 9. The gate. A warning gets clicked past, so this refuses the write.
--
--    Only vendors with a declared risk category are gated: an existing vendor
--    with no categories recorded is left alone rather than being retroactively
--    blocked by a migration.
CREATE OR REPLACE FUNCTION public.enforce_vendor_insurance_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
BEGIN
    IF NEW.approval_status <> 'APPROVED' OR OLD.approval_status = 'APPROVED' THEN
        RETURN NEW;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.event_vendor_categories WHERE vendor_id = NEW.id
    ) THEN
        RETURN NEW;
    END IF;

    v_status := public.vendor_insurance_status(NEW.id);

    IF v_status <> 'COMPLIANT' THEN
        RAISE EXCEPTION
            'Vendor % cannot be approved: insurance status is %',
            NEW.name, v_status
            USING HINT = 'Check vendor_coverage_shortfalls() for the specific deficient lines.';
    END IF;

    INSERT INTO public.vendor_insurance_verifications (vendor_id, certificate_id, verified_by, outcome)
    SELECT NEW.id, c.id, auth.uid(), 'COMPLIANT'
    FROM public.vendor_insurance_certificates c
    WHERE c.vendor_id = NEW.id
    ORDER BY c.effective_until DESC
    LIMIT 1;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_vendor_insurance ON public.event_vendors;
CREATE TRIGGER trg_enforce_vendor_insurance
    BEFORE UPDATE OF approval_status ON public.event_vendors
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_vendor_insurance_on_approval();

-- 10. Certificates lapsing soon, so the renewal is chased rather than
--     discovered by the gate failing on the day.
CREATE OR REPLACE FUNCTION public.get_expiring_vendor_certificates(p_within_days INTEGER DEFAULT 45)
RETURNS TABLE (
    certificate_id UUID,
    vendor_id UUID,
    vendor_name TEXT,
    expires_at TIMESTAMPTZ,
    days_remaining INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        c.id,
        c.vendor_id,
        v.name,
        c.effective_until,
        EXTRACT(DAY FROM c.effective_until - NOW())::INTEGER
    FROM public.vendor_insurance_certificates c
    JOIN public.event_vendors v ON v.id = c.vendor_id
    WHERE c.effective_until > NOW()
      AND c.effective_until <= NOW() + (p_within_days || ' days')::INTERVAL
    ORDER BY c.effective_until ASC, c.id ASC;
$$;

-- 11. Row level security. Certificates carry a vendor's commercial terms and
--     the verification log is an audit record, so neither is browsable.
ALTER TABLE public.vendor_insurance_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_insurance_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_insurance_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_vendor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_insurance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_insurance_required_endorsements ENABLE ROW LEVEL SECURITY;

-- Requirements are published policy: a vendor has to be able to read what is
-- being asked of them before they can supply it.
DROP POLICY IF EXISTS "Insurance requirements are readable"
    ON public.vendor_insurance_requirements;
CREATE POLICY "Insurance requirements are readable"
    ON public.vendor_insurance_requirements FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Required endorsements are readable"
    ON public.vendor_insurance_required_endorsements;
CREATE POLICY "Required endorsements are readable"
    ON public.vendor_insurance_required_endorsements FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Vendor categories are readable" ON public.event_vendor_categories;
CREATE POLICY "Vendor categories are readable"
    ON public.event_vendor_categories FOR SELECT
    TO authenticated
    USING (TRUE);

-- The verification log is append-only by construction: there is no update or
-- delete policy, so a record of what was checked cannot be revised afterwards.
DROP POLICY IF EXISTS "Verifications are insert only" ON public.vendor_insurance_verifications;
CREATE POLICY "Verifications are insert only"
    ON public.vendor_insurance_verifications FOR INSERT
    TO authenticated
    WITH CHECK (verified_by = auth.uid());

REVOKE ALL ON public.vendor_insurance_certificates FROM anon;
REVOKE ALL ON public.vendor_insurance_coverage FROM anon;

COMMENT ON TABLE public.vendor_insurance_certificates IS
    'Certificates of insurance evidencing third-party vendor cover (#3397).';
COMMENT ON FUNCTION public.vendor_insurance_status IS
    'Compliance verdict for a vendor, testing the policy period against the load-in to teardown window rather than the published event hours.';
COMMENT ON FUNCTION public.vendor_effective_coverage IS
    'Per-line cover including any umbrella. An umbrella tops up a line that already has cover and never creates cover on a line that has none.';
COMMENT ON TABLE public.vendor_insurance_verifications IS
    'Append-only record of what was checked, by whom, and against which requirements.';
