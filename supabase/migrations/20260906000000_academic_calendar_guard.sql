-- Migration: 20260906000000_academic_calendar_guard.sql
-- Description: Issue #3137 - Academic Calendar Blackout Guard

-- 1. Academic years, so term dates can be maintained per year without a code
--    change every August.
CREATE TABLE IF NOT EXISTS public.academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL UNIQUE,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    -- IANA timezone of the institution. All calendar comparisons are made in
    -- this zone rather than UTC, so an event at 23:00 local the night before an
    -- exam period is not misclassified as falling inside it.
    time_zone TEXT NOT NULL DEFAULT 'UTC',
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT academic_years_ends_after_starts CHECK (ends_on > starts_on)
);

-- Only one academic year may be marked current.
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_years_one_current
    ON public.academic_years (is_current)
    WHERE is_current;

-- 2. Admin-maintained calendar periods. Enforcement is graded rather than a
--    boolean: a hard block on everything gets routed around instead of obeyed.
CREATE TABLE IF NOT EXISTS public.academic_calendar_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    period_type TEXT NOT NULL CHECK (
        period_type IN ('TERM', 'READING_WEEK', 'EXAM_PERIOD', 'CLOSURE', 'ORIENTATION', 'HOLIDAY')
    ),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    -- NULL means fall back to the default for the period type.
    enforcement TEXT CHECK (enforcement IS NULL OR enforcement IN ('BLOCKED', 'WARN', 'INFO')),
    quiet_start_hour SMALLINT CHECK (quiet_start_hour IS NULL OR (quiet_start_hour BETWEEN 0 AND 23)),
    quiet_end_hour SMALLINT CHECK (quiet_end_hour IS NULL OR (quiet_end_hour BETWEEN 0 AND 23)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT academic_periods_end_after_start CHECK (end_date >= start_date),
    -- Quiet hours are declared as a pair or not at all.
    CONSTRAINT academic_periods_quiet_hours_paired CHECK (
        (quiet_start_hour IS NULL AND quiet_end_hour IS NULL)
        OR (quiet_start_hour IS NOT NULL AND quiet_end_hour IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_academic_periods_range
    ON public.academic_calendar_periods (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_academic_periods_year
    ON public.academic_calendar_periods (academic_year_id);

-- 3. Event categories that are always permitted, even inside a blocked period.
--    A wellbeing drop-in during exam week is exactly what students need most.
CREATE TABLE IF NOT EXISTS public.academic_blackout_exemptions (
    category TEXT PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.academic_blackout_exemptions (category, description)
VALUES
    ('study-session', 'Peer study and revision sessions.'),
    ('wellbeing', 'Wellbeing and mental health drop-ins.'),
    ('academic-support', 'Tutoring, writing centre and academic skills sessions.'),
    ('welfare', 'Welfare, hardship and support services.')
ON CONFLICT (category) DO NOTHING;

-- 4. Records the organiser's acknowledgement of a WARN-level conflict, so
--    "nobody told me it was reading week" is answerable after the fact.
CREATE TABLE IF NOT EXISTS public.event_calendar_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.academic_calendar_periods(id) ON DELETE CASCADE,
    acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT event_calendar_ack_unique UNIQUE (event_id, period_id)
);

-- 5. Periods overlapping a proposed window, with the resolved enforcement
--    level. Date comparison is done after converting the supplied timestamps
--    into the institution's timezone, mirroring zonedParts() in
--    src/lib/academicCalendarGuard.ts.
CREATE OR REPLACE FUNCTION public.get_overlapping_academic_periods(
    p_starts_at TIMESTAMPTZ,
    p_ends_at TIMESTAMPTZ
)
RETURNS TABLE (
    period_id UUID,
    period_name TEXT,
    period_type TEXT,
    enforcement TEXT,
    start_date DATE,
    end_date DATE,
    overlap_start DATE,
    overlap_end DATE,
    overlap_days INTEGER,
    quiet_start_hour SMALLINT,
    quiet_end_hour SMALLINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    WITH institution AS (
        SELECT COALESCE(
            (SELECT time_zone FROM public.academic_years WHERE is_current LIMIT 1),
            'UTC'
        ) AS tz
    ),
    window_dates AS (
        SELECT
            (p_starts_at AT TIME ZONE i.tz)::DATE AS window_start,
            (p_ends_at AT TIME ZONE i.tz)::DATE AS window_end
        FROM institution i
    )
    SELECT
        p.id AS period_id,
        p.name AS period_name,
        p.period_type,
        COALESCE(
            p.enforcement,
            CASE p.period_type
                WHEN 'EXAM_PERIOD' THEN 'BLOCKED'
                WHEN 'CLOSURE' THEN 'BLOCKED'
                WHEN 'READING_WEEK' THEN 'WARN'
                ELSE 'INFO'
            END
        ) AS enforcement,
        p.start_date,
        p.end_date,
        GREATEST(p.start_date, w.window_start) AS overlap_start,
        LEAST(p.end_date, w.window_end) AS overlap_end,
        (LEAST(p.end_date, w.window_end) - GREATEST(p.start_date, w.window_start) + 1)::INTEGER
            AS overlap_days,
        p.quiet_start_hour,
        p.quiet_end_hour
    FROM public.academic_calendar_periods p
    CROSS JOIN window_dates w
    WHERE p.start_date <= w.window_end
      AND p.end_date >= w.window_start
    ORDER BY
        CASE COALESCE(
            p.enforcement,
            CASE p.period_type
                WHEN 'EXAM_PERIOD' THEN 'BLOCKED'
                WHEN 'CLOSURE' THEN 'BLOCKED'
                WHEN 'READING_WEEK' THEN 'WARN'
                ELSE 'INFO'
            END
        )
            WHEN 'BLOCKED' THEN 0
            WHEN 'WARN' THEN 1
            ELSE 2
        END,
        p.start_date;
$$;

-- 6. Convenience wrapper returning a single decision for a proposed window,
--    honouring the exemption list.
CREATE OR REPLACE FUNCTION public.check_academic_blackout(
    p_starts_at TIMESTAMPTZ,
    p_ends_at TIMESTAMPTZ,
    p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    decision TEXT,
    blocking_periods TEXT[],
    warning_periods TEXT[],
    exemption_applied BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_is_exempt BOOLEAN;
    v_blocking TEXT[];
    v_warning TEXT[];
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.academic_blackout_exemptions
        WHERE LOWER(category) = LOWER(COALESCE(p_category, ''))
    ) INTO v_is_exempt;

    SELECT
        COALESCE(ARRAY_AGG(o.period_name) FILTER (WHERE o.enforcement = 'BLOCKED'), ARRAY[]::TEXT[]),
        COALESCE(ARRAY_AGG(o.period_name) FILTER (WHERE o.enforcement = 'WARN'), ARRAY[]::TEXT[])
    INTO v_blocking, v_warning
    FROM public.get_overlapping_academic_periods(p_starts_at, p_ends_at) o;

    RETURN QUERY SELECT
        CASE
            WHEN CARDINALITY(v_blocking) > 0 AND NOT v_is_exempt THEN 'BLOCKED'
            WHEN CARDINALITY(v_warning) > 0 THEN 'WARN'
            ELSE 'ALLOWED'
        END::TEXT,
        v_blocking,
        v_warning,
        (v_is_exempt AND CARDINALITY(v_blocking) > 0);
END;
$$;

-- 7. Row level security. The calendar itself is public reference data; only
--    admins may change it.
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_calendar_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_blackout_exemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_calendar_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Academic years are publicly readable" ON public.academic_years;
CREATE POLICY "Academic years are publicly readable"
    ON public.academic_years FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "Calendar periods are publicly readable" ON public.academic_calendar_periods;
CREATE POLICY "Calendar periods are publicly readable"
    ON public.academic_calendar_periods FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "Exemptions are publicly readable" ON public.academic_blackout_exemptions;
CREATE POLICY "Exemptions are publicly readable"
    ON public.academic_blackout_exemptions FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "Organisers record their own acknowledgements"
    ON public.event_calendar_acknowledgements;
CREATE POLICY "Organisers record their own acknowledgements"
    ON public.event_calendar_acknowledgements FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_calendar_acknowledgements.event_id
              AND e.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Acknowledgements readable by signed in users"
    ON public.event_calendar_acknowledgements;
CREATE POLICY "Acknowledgements readable by signed in users"
    ON public.event_calendar_acknowledgements FOR SELECT
    USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.academic_calendar_periods IS
    'Admin-maintained term, reading week, exam and closure dates driving the blackout guard (#3137).';
COMMENT ON COLUMN public.academic_calendar_periods.enforcement IS
    'BLOCKED, WARN or INFO. NULL falls back to the default for the period type.';
