-- ============================================================
-- Migration: 20270204000000_responder_coverage_planner.sql
-- Issue: #3754 — Dynamic Certified First-Aid Responder Coverage
--                Planner
--
-- Context
--   First-aid cover is treated as a staffing checkbox ("we have
--   first-aiders") rather than a continuous-coverage constraint over
--   the event timeline. Two failure modes stay invisible until an
--   incident: consecutive duty blocks that do not actually abut, and
--   rostered responders whose certification lapsed months ago.
--
-- Design notes
--   1. Certifications are verified records with an issue and expiry
--      date. Validity is always evaluated against the *duty date*,
--      never against today, so a certificate expiring mid-event
--      correctly invalidates only the later part of that block.
--   2. Risk tiers map to a required concurrent responder count and a
--      minimum certification level. Three basic first-aiders do not
--      satisfy a tier that needs an advanced responder, so the level
--      is part of the requirement rather than a nice-to-have.
--   3. The sweep-line coverage analysis lives in
--      src/lib/responderCoverage.ts. This migration owns the data,
--      the tier table, and an RPC that hands the client an
--      already-authorised roster to analyse.
--   4. Medical certification is sensitive personal data. RLS keeps
--      certificates readable by their holder and by safety officers,
--      not by the club at large.
-- ============================================================

BEGIN;

-- ─── 1. Enums ───────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'certification_level') THEN
        CREATE TYPE public.certification_level AS ENUM (
            'basic',
            'intermediate',
            'advanced'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_risk_tier') THEN
        CREATE TYPE public.event_risk_tier AS ENUM (
            'low',
            'moderate',
            'high',
            'extreme'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'duty_status') THEN
        CREATE TYPE public.duty_status AS ENUM (
            'assigned',
            'confirmed',
            'on_station',
            'released',
            'cancelled'
        );
    END IF;
END$$;

-- ─── 2. Tier requirements ───────────────────────────────────────────
-- Data rather than constants so an institution can align these with
-- its own safety policy without a code change. Defaults mirror
-- TIER_REQUIREMENTS in src/lib/responderCoverage.ts.
CREATE TABLE IF NOT EXISTS public.risk_tier_requirements (
    tier                public.event_risk_tier PRIMARY KEY,
    required_concurrent INTEGER NOT NULL,
    minimum_level       public.certification_level NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT risk_tier_required_positive CHECK (required_concurrent >= 1)
);

INSERT INTO public.risk_tier_requirements (tier, required_concurrent, minimum_level)
VALUES
    ('low',      1, 'basic'),
    ('moderate', 2, 'basic'),
    ('high',     3, 'intermediate'),
    ('extreme',  4, 'advanced')
ON CONFLICT (tier) DO NOTHING;

-- ─── 3. Certifications ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.responder_certifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    level           public.certification_level NOT NULL,
    issuing_body    TEXT NOT NULL,
    certificate_ref TEXT,
    issued_on       DATE NOT NULL,
    expires_on      DATE NOT NULL,
    -- A certificate nobody checked is a certificate nobody can rely on
    -- in an incident review.
    verified_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT responder_cert_dates_ordered CHECK (expires_on > issued_on),
    CONSTRAINT responder_cert_body_not_blank
        CHECK (LENGTH(TRIM(issuing_body)) > 0)
);

COMMENT ON TABLE public.responder_certifications IS
    'Issue #3754 — first-aid certifications. Validity is evaluated against the duty date, not against today.';

CREATE INDEX IF NOT EXISTS idx_responder_certs_user
    ON public.responder_certifications (user_id, expires_on DESC);
-- Supports the "expiring within N days" renewal sweep.
CREATE INDEX IF NOT EXISTS idx_responder_certs_expiry
    ON public.responder_certifications (expires_on);

-- ─── 4. Event risk assessment ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_risk_assessments (
    event_id            UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    expected_attendance INTEGER NOT NULL DEFAULT 0,
    activity_risk       TEXT NOT NULL DEFAULT 'sedentary',
    -- Derived tier, with an override for the cases the formula cannot
    -- see (a low-attendance event with a pyrotechnics licence).
    derived_tier        public.event_risk_tier NOT NULL DEFAULT 'low',
    override_tier       public.event_risk_tier,
    -- An override without a reason is indistinguishable from someone
    -- dialling the requirement down to make the warning go away.
    override_reason     TEXT,
    coverage_starts_at  TIMESTAMPTZ NOT NULL,
    coverage_ends_at    TIMESTAMPTZ NOT NULL,
    assessed_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT event_risk_window_ordered
        CHECK (coverage_ends_at > coverage_starts_at),
    CONSTRAINT event_risk_attendance_nonneg
        CHECK (expected_attendance >= 0),
    CONSTRAINT event_risk_activity_known
        CHECK (activity_risk IN ('sedentary', 'active', 'contact_sport', 'hazardous')),
    CONSTRAINT event_risk_override_needs_reason
        CHECK (override_tier IS NULL OR LENGTH(TRIM(COALESCE(override_reason, ''))) > 0)
);

-- ─── 5. Duty blocks ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_responder_duties (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    responder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    starts_at    TIMESTAMPTZ NOT NULL,
    ends_at      TIMESTAMPTZ NOT NULL,
    station      TEXT,
    status       public.duty_status NOT NULL DEFAULT 'assigned',
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT responder_duty_window_ordered CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_responder_duties_event
    ON public.event_responder_duties (event_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_responder_duties_responder
    ON public.event_responder_duties (responder_id, starts_at);

-- ─── 6. Double-booking guard ────────────────────────────────────────
-- One responder cannot be on station at two events at once. A roster
-- that assumes they can looks fully covered and is not.
CREATE OR REPLACE FUNCTION public.reject_overlapping_responder_duty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conflict RECORD;
BEGIN
    IF NEW.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    SELECT d.id, d.event_id, d.starts_at, d.ends_at
    INTO v_conflict
    FROM public.event_responder_duties d
    WHERE d.responder_id = NEW.responder_id
      AND d.id <> NEW.id
      AND d.status <> 'cancelled'
      -- Half-open overlap: a block ending exactly when another begins
      -- is a handover, not a conflict.
      AND d.starts_at < NEW.ends_at
      AND d.ends_at > NEW.starts_at
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Responder is already on duty from % to % (duty %)',
            v_conflict.starts_at, v_conflict.ends_at, v_conflict.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_responder_duty_overlap ON public.event_responder_duties;
CREATE TRIGGER trg_responder_duty_overlap
    BEFORE INSERT OR UPDATE ON public.event_responder_duties
    FOR EACH ROW EXECUTE FUNCTION public.reject_overlapping_responder_duty();

-- ─── 7. updated_at maintenance ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_responder_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_responder_certs_touch ON public.responder_certifications;
CREATE TRIGGER trg_responder_certs_touch
    BEFORE UPDATE ON public.responder_certifications
    FOR EACH ROW EXECUTE FUNCTION public.touch_responder_updated_at();

DROP TRIGGER IF EXISTS trg_responder_duties_touch ON public.event_responder_duties;
CREATE TRIGGER trg_responder_duties_touch
    BEFORE UPDATE ON public.event_responder_duties
    FOR EACH ROW EXECUTE FUNCTION public.touch_responder_updated_at();

DROP TRIGGER IF EXISTS trg_event_risk_touch ON public.event_risk_assessments;
CREATE TRIGGER trg_event_risk_touch
    BEFORE UPDATE ON public.event_risk_assessments
    FOR EACH ROW EXECUTE FUNCTION public.touch_responder_updated_at();

-- ─── 8. Access predicate ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_safety_officer(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.events e
        JOIN public.club_members cm ON cm.club_id = e.club_id
        WHERE e.id = p_event_id
          AND cm.user_id = p_user_id
          AND cm.status::TEXT = 'approved'
          -- Cast to TEXT: the member_role enum differs across
          -- deployments, and an enum-literal comparison against a
          -- value the local enum lacks raises rather than returning
          -- false.
          AND cm.role::TEXT IN ('owner', 'admin', 'officer')
    );
$$;

-- ─── 9. Coverage roster RPC ─────────────────────────────────────────
-- Returns the duty blocks for an event together with each responder's
-- certifications, so the client can run the sweep-line analysis.
--
-- Certifications are returned for rostered responders only. A safety
-- officer has no business reading the medical certifications of people
-- who are not on this event's roster.
CREATE OR REPLACE FUNCTION public.get_event_coverage_roster(p_event_id UUID)
RETURNS TABLE (
    duty_id        UUID,
    responder_id   UUID,
    responder_name TEXT,
    starts_at      TIMESTAMPTZ,
    ends_at        TIMESTAMPTZ,
    station        TEXT,
    status         TEXT,
    certifications JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_safety_officer(p_event_id, auth.uid()) THEN
        RAISE EXCEPTION 'Only event safety officers may view the coverage roster';
    END IF;

    RETURN QUERY
    SELECT
        d.id,
        d.responder_id,
        COALESCE(p.full_name, 'Unnamed responder'),
        d.starts_at,
        d.ends_at,
        d.station,
        d.status::TEXT,
        COALESCE(
            (
                SELECT JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'id', c.id,
                        'userId', c.user_id,
                        'level', c.level,
                        'issuingBody', c.issuing_body,
                        'issuedOn', c.issued_on,
                        'expiresOn', c.expires_on
                    )
                    ORDER BY c.expires_on DESC
                )
                FROM public.responder_certifications c
                WHERE c.user_id = d.responder_id
                  -- Unverified certificates must not prop up a roster.
                  AND c.verified_at IS NOT NULL
            ),
            '[]'::JSONB
        )
    FROM public.event_responder_duties d
    LEFT JOIN public.profiles p ON p.id = d.responder_id
    WHERE d.event_id = p_event_id
      AND d.status <> 'cancelled'
    ORDER BY d.starts_at;
END;
$$;

-- ─── 10. Renewal sweep RPC ──────────────────────────────────────────
-- Certifications lapsing inside a horizon, so coordinators can chase
-- renewals before they silently invalidate a future roster.
CREATE OR REPLACE FUNCTION public.get_expiring_certifications(
    p_club_id      UUID,
    p_horizon_days INTEGER DEFAULT 60
)
RETURNS TABLE (
    certification_id UUID,
    user_id          UUID,
    responder_name   TEXT,
    level            TEXT,
    expires_on       DATE,
    days_remaining   INTEGER,
    is_expired       BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = p_club_id
          AND cm.user_id = auth.uid()
          AND cm.status::TEXT = 'approved'
          AND cm.role::TEXT IN ('owner', 'admin', 'officer')
    ) THEN
        RAISE EXCEPTION 'Only club officers may review certification expiry';
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.user_id,
        COALESCE(p.full_name, 'Unnamed responder'),
        c.level::TEXT,
        c.expires_on,
        (c.expires_on - CURRENT_DATE)::INTEGER,
        c.expires_on <= CURRENT_DATE
    FROM public.responder_certifications c
    JOIN public.club_members cm
      ON cm.user_id = c.user_id
     AND cm.club_id = p_club_id
     AND cm.status::TEXT = 'approved'
    LEFT JOIN public.profiles p ON p.id = c.user_id
    WHERE c.expires_on <= CURRENT_DATE + p_horizon_days
    ORDER BY c.expires_on;
END;
$$;

-- ─── 11. Row Level Security ─────────────────────────────────────────
ALTER TABLE public.responder_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_responder_duties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_tier_requirements ENABLE ROW LEVEL SECURITY;

-- Medical certification is sensitive. A responder always sees their
-- own; officers see those of people rostered on their events.
DROP POLICY IF EXISTS "Responders read own certifications" ON public.responder_certifications;
CREATE POLICY "Responders read own certifications"
    ON public.responder_certifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Officers read rostered certifications" ON public.responder_certifications;
CREATE POLICY "Officers read rostered certifications"
    ON public.responder_certifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.event_responder_duties d
            WHERE d.responder_id = responder_certifications.user_id
              AND public.is_safety_officer(d.event_id, auth.uid())
        )
    );

DROP POLICY IF EXISTS "Responders submit own certifications" ON public.responder_certifications;
CREATE POLICY "Responders submit own certifications"
    ON public.responder_certifications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Officers verify certifications" ON public.responder_certifications;
CREATE POLICY "Officers verify certifications"
    ON public.responder_certifications FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.event_responder_duties d
            WHERE d.responder_id = responder_certifications.user_id
              AND public.is_safety_officer(d.event_id, auth.uid())
        )
    );

DROP POLICY IF EXISTS "Officers manage duties" ON public.event_responder_duties;
CREATE POLICY "Officers manage duties"
    ON public.event_responder_duties FOR ALL
    USING (public.is_safety_officer(event_id, auth.uid()))
    WITH CHECK (public.is_safety_officer(event_id, auth.uid()));

DROP POLICY IF EXISTS "Responders read own duties" ON public.event_responder_duties;
CREATE POLICY "Responders read own duties"
    ON public.event_responder_duties FOR SELECT
    USING (auth.uid() = responder_id);

DROP POLICY IF EXISTS "Officers manage risk assessments" ON public.event_risk_assessments;
CREATE POLICY "Officers manage risk assessments"
    ON public.event_risk_assessments FOR ALL
    USING (public.is_safety_officer(event_id, auth.uid()))
    WITH CHECK (public.is_safety_officer(event_id, auth.uid()));

DROP POLICY IF EXISTS "Anyone reads tier requirements" ON public.risk_tier_requirements;
CREATE POLICY "Anyone reads tier requirements"
    ON public.risk_tier_requirements FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- ─── 12. Grants ─────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.responder_certifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_responder_duties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_risk_assessments TO authenticated;
GRANT SELECT ON public.risk_tier_requirements TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_coverage_roster(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_expiring_certifications(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_safety_officer(UUID, UUID) TO authenticated;

COMMIT;
