-- ============================================================
-- Migration: 20270201000000_volunteer_shift_reliability.sql
-- Issue: #3751 — Dynamic Volunteer Shift Reliability Score &
--                No-Show Risk Forecast
--
-- Context
--   `event_shifts` / `shift_assignments` (20260816000001) record who
--   *claimed* a shift. Nothing records who actually turned up, so a
--   coordinator cannot tell a dependable volunteer from a serial
--   ghost. This migration closes that loop.
--
-- Design notes
--   1. `shift_attendance_records` is the outcome ledger — exactly one
--      row per (shift, volunteer). It is written by coordinators at
--      or after the shift.
--   2. Outcomes distinguish a *silent* no-show from a withdrawal made
--      with enough notice to re-fill the slot. Punishing both
--      identically teaches volunteers to stay silent, which is the
--      opposite of what we want.
--   3. Scoring uses exponential time decay so recent behaviour
--      dominates, plus shrinkage toward a neutral prior so a
--      volunteer with one data point is not branded for life. The
--      same maths lives in src/lib/volunteerReliability.ts for the
--      client; this RPC exists so the coordinator dashboard can rank
--      a whole event without shipping every historical record to the
--      browser.
--   4. Reliability is coordinator-only data. RLS keeps it away from
--      the volunteers being scored and from other clubs entirely.
-- ============================================================

BEGIN;

-- ─── 1. Outcome enum ────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_outcome') THEN
        CREATE TYPE public.shift_outcome AS ENUM (
            'attended',           -- turned up and worked the shift
            'late',               -- turned up, but materially late
            'no_show',            -- never appeared, no notice given
            'excused',            -- coordinator excused (illness, exam clash)
            'cancelled_in_time'   -- withdrew with enough notice to re-fill
        );
    END IF;
END$$;

-- ─── 2. Attendance ledger ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shift_attendance_records (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id      UUID NOT NULL REFERENCES public.event_shifts(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    outcome       public.shift_outcome NOT NULL,
    -- Denormalized copy of the shift start. The decay maths keys off
    -- *when the shift was*, and copying it here means scoring never
    -- has to join back to event_shifts, which also keeps historical
    -- scores stable if a shift is later rescheduled.
    shift_start   TIMESTAMPTZ NOT NULL,
    -- Who recorded the outcome. Nullable so a system/cron sweep that
    -- auto-marks un-checked-in assignees can write rows too.
    recorded_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes         TEXT,
    recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One verdict per volunteer per shift. Correcting a mistake is an
    -- UPDATE, not a second row, so the ledger can never double-count.
    CONSTRAINT shift_attendance_unique UNIQUE (shift_id, user_id)
);

COMMENT ON TABLE public.shift_attendance_records IS
    'Issue #3751 — outcome ledger for volunteer shifts. One row per (shift, volunteer).';
COMMENT ON COLUMN public.shift_attendance_records.shift_start IS
    'Denormalized shift start time; drives time-decay weighting of the outcome.';

-- Query patterns: (a) a volunteer''s history newest-first for scoring,
-- (b) every outcome for one shift when a coordinator opens it.
CREATE INDEX IF NOT EXISTS idx_shift_attendance_user_recency
    ON public.shift_attendance_records (user_id, shift_start DESC);
CREATE INDEX IF NOT EXISTS idx_shift_attendance_shift
    ON public.shift_attendance_records (shift_id);

-- ─── 3. Per-club scoring configuration ──────────────────────────────
-- A 60-day half-life suits a weekly-events club; a society that runs
-- two events a year needs a much longer one or every volunteer looks
-- provisional forever. Defaults mirror DEFAULT_RELIABILITY_CONFIG.
CREATE TABLE IF NOT EXISTS public.club_reliability_settings (
    club_id           UUID PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
    half_life_days    INTEGER NOT NULL DEFAULT 60,
    prior_weight      NUMERIC(5,2) NOT NULL DEFAULT 3.0,
    prior_score       NUMERIC(4,3) NOT NULL DEFAULT 0.800,
    late_credit       NUMERIC(4,3) NOT NULL DEFAULT 0.600,
    max_age_days      INTEGER NOT NULL DEFAULT 540,
    -- Hours of notice below which a withdrawal counts as a no-show
    -- rather than a cancellation-in-time.
    notice_hours      INTEGER NOT NULL DEFAULT 48,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT club_reliability_half_life_positive CHECK (half_life_days > 0),
    CONSTRAINT club_reliability_prior_range CHECK (prior_score BETWEEN 0 AND 1),
    CONSTRAINT club_reliability_late_range CHECK (late_credit BETWEEN 0 AND 1),
    CONSTRAINT club_reliability_prior_weight_range CHECK (prior_weight >= 0),
    CONSTRAINT club_reliability_max_age_positive CHECK (max_age_days > 0),
    CONSTRAINT club_reliability_notice_nonneg CHECK (notice_hours >= 0)
);

-- ─── 4. updated_at maintenance ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_shift_attendance_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_attendance_touch ON public.shift_attendance_records;
CREATE TRIGGER trg_shift_attendance_touch
    BEFORE UPDATE ON public.shift_attendance_records
    FOR EACH ROW EXECUTE FUNCTION public.touch_shift_attendance_updated_at();

-- ─── 5. Coordinator predicate ───────────────────────────────────────
-- A coordinator is an owner/admin of the club that owns the event the
-- shift belongs to. Centralised here so every policy below agrees on
-- the definition.
-- Club-level coordinator check, shared by the RPCs and policies below.
CREATE OR REPLACE FUNCTION public.is_club_coordinator(p_club_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = p_club_id
          AND cm.user_id = p_user_id
          AND cm.status::TEXT = 'approved'
          -- Cast to TEXT: the member_role enum varies across deployments
          -- (some carry 'officer', some only 'member'/'admin'), and an
          -- enum-literal comparison against a value the local enum lacks
          -- raises rather than returning false.
          AND cm.role::TEXT IN ('owner', 'admin', 'officer')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_shift_coordinator(p_shift_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.event_shifts s
        JOIN public.events e ON e.id = s.event_id
        JOIN public.club_members cm ON cm.club_id = e.club_id
        WHERE s.id = p_shift_id
          AND cm.user_id = p_user_id
          AND cm.status::TEXT = 'approved'
          -- Cast to TEXT: the member_role enum varies across deployments
          -- (some carry 'officer', some only 'member'/'admin'), and an
          -- enum-literal comparison against a value the local enum lacks
          -- raises rather than returning false.
          AND cm.role::TEXT IN ('owner', 'admin', 'officer')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_event_coordinator(p_event_id UUID, p_user_id UUID)
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
          -- Cast to TEXT: the member_role enum varies across deployments
          -- (some carry 'officer', some only 'member'/'admin'), and an
          -- enum-literal comparison against a value the local enum lacks
          -- raises rather than returning false.
          AND cm.role::TEXT IN ('owner', 'admin', 'officer')
    );
$$;

-- ─── 6. Reliability scoring RPC ─────────────────────────────────────
-- Mirrors computeReliabilityProfile() in src/lib/volunteerReliability.ts.
-- Returns one row per requested user. Users with no history come back
-- at exactly the prior score rather than being omitted, so callers can
-- rely on getting a row for everyone they asked about.
CREATE OR REPLACE FUNCTION public.get_volunteer_reliability(
    p_club_id  UUID,
    p_user_ids UUID[]
)
RETURNS TABLE (
    user_id                UUID,
    score                  NUMERIC,
    band                   TEXT,
    weighted_total         NUMERIC,
    weighted_credit        NUMERIC,
    counted_outcomes       INTEGER,
    attended_count         INTEGER,
    late_count             INTEGER,
    no_show_count          INTEGER,
    excused_count          INTEGER,
    cancelled_count        INTEGER,
    current_no_show_streak INTEGER,
    is_provisional         BOOLEAN,
    last_outcome_at        TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cfg RECORD;
BEGIN
    IF NOT public.is_club_coordinator(p_club_id, auth.uid()) THEN
        RAISE EXCEPTION 'Only club coordinators may read volunteer reliability data';
    END IF;

    SELECT
        COALESCE(s.half_life_days, 60)  AS half_life_days,
        COALESCE(s.prior_weight, 3.0)   AS prior_weight,
        COALESCE(s.prior_score, 0.800)  AS prior_score,
        COALESCE(s.late_credit, 0.600)  AS late_credit,
        COALESCE(s.max_age_days, 540)   AS max_age_days
    INTO cfg
    FROM (SELECT p_club_id AS club_id) base
    LEFT JOIN public.club_reliability_settings s ON s.club_id = base.club_id;

    RETURN QUERY
    WITH requested AS (
        SELECT UNNEST(p_user_ids) AS uid
    ),
    -- Only outcomes inside the age window participate. Credit is NULL
    -- for excused / cancelled-in-time so they drop out of the ratio
    -- while still being counted in the raw tallies.
    weighted AS (
        SELECT
            r.user_id,
            r.outcome,
            r.shift_start,
            POWER(
                0.5,
                GREATEST(EXTRACT(EPOCH FROM (NOW() - r.shift_start)) / 86400.0, 0)
                    / cfg.half_life_days
            )::NUMERIC AS weight,
            CASE r.outcome
                WHEN 'attended' THEN 1.0::NUMERIC
                WHEN 'late'     THEN cfg.late_credit
                WHEN 'no_show'  THEN 0.0::NUMERIC
                ELSE NULL
            END AS credit
        FROM public.shift_attendance_records r
        JOIN requested q ON q.uid = r.user_id
        WHERE r.shift_start >= NOW() - (cfg.max_age_days || ' days')::INTERVAL
    ),
    aggregated AS (
        SELECT
            w.user_id,
            COALESCE(SUM(w.weight) FILTER (WHERE w.credit IS NOT NULL), 0) AS w_total,
            COALESCE(SUM(w.weight * w.credit) FILTER (WHERE w.credit IS NOT NULL), 0) AS w_credit,
            COUNT(*) FILTER (WHERE w.credit IS NOT NULL)::INTEGER AS counted,
            COUNT(*) FILTER (WHERE w.outcome = 'attended')::INTEGER AS n_attended,
            COUNT(*) FILTER (WHERE w.outcome = 'late')::INTEGER AS n_late,
            COUNT(*) FILTER (WHERE w.outcome = 'no_show')::INTEGER AS n_no_show,
            COUNT(*) FILTER (WHERE w.outcome = 'excused')::INTEGER AS n_excused,
            COUNT(*) FILTER (WHERE w.outcome = 'cancelled_in_time')::INTEGER AS n_cancelled,
            MAX(w.shift_start) AS last_at
        FROM weighted w
        GROUP BY w.user_id
    ),
    -- Consecutive no-shows ending at the most recent *counted* outcome.
    -- Excused shifts are skipped rather than breaking the run.
    streaks AS (
        SELECT
            s.user_id,
            COUNT(*)::INTEGER AS streak
        FROM (
            SELECT
                w.user_id,
                w.outcome,
                ROW_NUMBER() OVER (PARTITION BY w.user_id ORDER BY w.shift_start DESC) AS rn,
                MIN(CASE WHEN w.outcome <> 'no_show' THEN 1 ELSE 0 END)
                    OVER (PARTITION BY w.user_id ORDER BY w.shift_start DESC
                          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS broken
            FROM weighted w
            WHERE w.credit IS NOT NULL
        ) s
        WHERE s.broken = 0
        GROUP BY s.user_id
    )
    SELECT
        q.uid,
        ROUND(
            (COALESCE(a.w_credit, 0) + cfg.prior_weight * cfg.prior_score)
                / NULLIF(COALESCE(a.w_total, 0) + cfg.prior_weight, 0),
            4
        ) AS score,
        CASE
            WHEN (COALESCE(a.w_credit, 0) + cfg.prior_weight * cfg.prior_score)
                     / NULLIF(COALESCE(a.w_total, 0) + cfg.prior_weight, 0) >= 0.90 THEN 'exemplary'
            WHEN (COALESCE(a.w_credit, 0) + cfg.prior_weight * cfg.prior_score)
                     / NULLIF(COALESCE(a.w_total, 0) + cfg.prior_weight, 0) >= 0.75 THEN 'reliable'
            WHEN (COALESCE(a.w_credit, 0) + cfg.prior_weight * cfg.prior_score)
                     / NULLIF(COALESCE(a.w_total, 0) + cfg.prior_weight, 0) >= 0.55 THEN 'watch'
            ELSE 'at_risk'
        END AS band,
        ROUND(COALESCE(a.w_total, 0), 4),
        ROUND(COALESCE(a.w_credit, 0), 4),
        COALESCE(a.counted, 0),
        COALESCE(a.n_attended, 0),
        COALESCE(a.n_late, 0),
        COALESCE(a.n_no_show, 0),
        COALESCE(a.n_excused, 0),
        COALESCE(a.n_cancelled, 0),
        COALESCE(st.streak, 0),
        COALESCE(a.counted, 0) < cfg.prior_weight,
        a.last_at
    FROM requested q
    LEFT JOIN aggregated a ON a.user_id = q.uid
    LEFT JOIN streaks st ON st.user_id = q.uid;
END;
$$;

-- ─── 7. Shift staffing forecast RPC ─────────────────────────────────
-- Returns one row per shift on an event, with expected attendance
-- computed as the sum of assignee reliability scores rather than the
-- raw signup count.
CREATE OR REPLACE FUNCTION public.forecast_event_shift_staffing(p_event_id UUID)
RETURNS TABLE (
    shift_id            UUID,
    shift_title         TEXT,
    start_time          TIMESTAMPTZ,
    end_time            TIMESTAMPTZ,
    capacity            INTEGER,
    signup_count        INTEGER,
    expected_attendance NUMERIC,
    forecast_gap        NUMERIC,
    risk                TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_club_id UUID;
BEGIN
    SELECT e.club_id INTO v_club_id FROM public.events e WHERE e.id = p_event_id;
    IF v_club_id IS NULL THEN
        RAISE EXCEPTION 'Event % not found', p_event_id;
    END IF;

    IF NOT public.is_club_coordinator(v_club_id, auth.uid()) THEN
        RAISE EXCEPTION 'Only club coordinators may forecast shift staffing';
    END IF;

    RETURN QUERY
    WITH assignees AS (
        SELECT sa.shift_id, sa.user_id
        FROM public.shift_assignments sa
        JOIN public.event_shifts s ON s.id = sa.shift_id
        WHERE s.event_id = p_event_id
    ),
    scored AS (
        SELECT
            a.shift_id,
            a.user_id,
            COALESCE(rel.score, 0.8) AS score
        FROM assignees a
        LEFT JOIN LATERAL (
            SELECT r.score
            FROM public.get_volunteer_reliability(v_club_id, ARRAY[a.user_id]) r
        ) rel ON TRUE
    ),
    per_shift AS (
        SELECT
            s.id            AS shift_id,
            s.title         AS shift_title,
            s.start_time,
            s.end_time,
            s.capacity,
            COUNT(sc.user_id)::INTEGER AS signup_count,
            ROUND(COALESCE(SUM(sc.score), 0), 2) AS expected
        FROM public.event_shifts s
        LEFT JOIN scored sc ON sc.shift_id = s.id
        WHERE s.event_id = p_event_id
        GROUP BY s.id, s.title, s.start_time, s.end_time, s.capacity
    )
    SELECT
        p.shift_id,
        p.shift_title,
        p.start_time,
        p.end_time,
        p.capacity,
        p.signup_count,
        p.expected,
        ROUND(GREATEST(p.capacity - p.expected, 0), 2),
        CASE
            WHEN p.capacity <= 0 THEN 'healthy'
            WHEN p.expected / p.capacity >= 1.00 THEN 'healthy'
            WHEN p.expected / p.capacity >= 0.85 THEN 'thin'
            WHEN p.expected / p.capacity >= 0.60 THEN 'at_risk'
            ELSE 'critical'
        END
    FROM per_shift p
    ORDER BY (p.expected / NULLIF(p.capacity, 0)) NULLS LAST, p.start_time;
END;
$$;

-- ─── 8. Row Level Security ──────────────────────────────────────────
ALTER TABLE public.shift_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_reliability_settings ENABLE ROW LEVEL SECURITY;

-- A volunteer may see their own outcomes — being told you were marked
-- a no-show is fair, and lets them contest it. They may not see
-- anybody else's, and they may not see derived scores at all.
DROP POLICY IF EXISTS "Volunteers read own attendance" ON public.shift_attendance_records;
CREATE POLICY "Volunteers read own attendance"
    ON public.shift_attendance_records
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Coordinators read shift attendance" ON public.shift_attendance_records;
CREATE POLICY "Coordinators read shift attendance"
    ON public.shift_attendance_records
    FOR SELECT
    USING (public.is_shift_coordinator(shift_id, auth.uid()));

-- Only coordinators write outcomes. A volunteer marking their own
-- attendance would make the whole ledger worthless.
DROP POLICY IF EXISTS "Coordinators write shift attendance" ON public.shift_attendance_records;
CREATE POLICY "Coordinators write shift attendance"
    ON public.shift_attendance_records
    FOR INSERT
    WITH CHECK (public.is_shift_coordinator(shift_id, auth.uid()));

DROP POLICY IF EXISTS "Coordinators amend shift attendance" ON public.shift_attendance_records;
CREATE POLICY "Coordinators amend shift attendance"
    ON public.shift_attendance_records
    FOR UPDATE
    USING (public.is_shift_coordinator(shift_id, auth.uid()))
    WITH CHECK (public.is_shift_coordinator(shift_id, auth.uid()));

DROP POLICY IF EXISTS "Coordinators manage reliability settings" ON public.club_reliability_settings;
CREATE POLICY "Coordinators manage reliability settings"
    ON public.club_reliability_settings
    FOR ALL
    USING (public.is_club_coordinator(club_id, auth.uid()))
    WITH CHECK (public.is_club_coordinator(club_id, auth.uid()));

-- ─── 9. Grants ──────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.shift_attendance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.club_reliability_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_volunteer_reliability(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.forecast_event_shift_staffing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_coordinator(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shift_coordinator(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_coordinator(UUID, UUID) TO authenticated;

COMMIT;
