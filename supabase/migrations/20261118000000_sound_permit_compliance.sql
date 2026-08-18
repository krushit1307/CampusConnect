-- Migration: 20261118000000_sound_permit_compliance.sql
-- Description: Issue #3399 - Amplified sound permit and noise curfew compliance
--
-- The logistics rule engine covers security forms and catering. Nothing covers
-- noise, which is the most reliably enforced constraint on an outdoor campus
-- event. Exam periods are read from academic_calendar_periods
-- (20260906000000_academic_calendar_guard) rather than restated here; a second
-- copy of the term dates would drift and be worse than none.

-- 1. Permitted hours by zone and day type.
--
--    A NULL window means no amplified sound at all on that day type, which is
--    a genuinely different statement from "permitted between two times" and
--    cannot be expressed by an hour pair.
CREATE TABLE IF NOT EXISTS public.noise_zone_windows (
    zone TEXT NOT NULL CHECK (
        zone IN (
            'OPEN_FIELD', 'RESIDENTIAL_ADJACENT', 'ACADEMIC_ADJACENT',
            'LIBRARY_ADJACENT', 'INDOOR_ISOLATED'
        )
    ),
    day_type TEXT NOT NULL CHECK (day_type IN ('WEEKNIGHT', 'WEEKEND', 'EXAM_PERIOD')),
    -- Minutes from local midnight. NULL in both means prohibited outright.
    start_minute SMALLINT CHECK (start_minute IS NULL OR start_minute BETWEEN 0 AND 1440),
    end_minute SMALLINT CHECK (end_minute IS NULL OR end_minute BETWEEN 0 AND 1440),
    PRIMARY KEY (zone, day_type),
    CONSTRAINT noise_window_paired CHECK (
        (start_minute IS NULL AND end_minute IS NULL)
        OR (start_minute IS NOT NULL AND end_minute IS NOT NULL AND end_minute > start_minute)
    )
);

INSERT INTO public.noise_zone_windows (zone, day_type, start_minute, end_minute)
VALUES
    ('OPEN_FIELD',           'WEEKNIGHT',    480, 1320),
    ('OPEN_FIELD',           'WEEKEND',      480, 1380),
    ('OPEN_FIELD',           'EXAM_PERIOD', NULL, NULL),
    ('RESIDENTIAL_ADJACENT', 'WEEKNIGHT',    540, 1260),
    ('RESIDENTIAL_ADJACENT', 'WEEKEND',      540, 1320),
    ('RESIDENTIAL_ADJACENT', 'EXAM_PERIOD', NULL, NULL),
    -- Teaching runs through the day, so amplification waits until the evening.
    ('ACADEMIC_ADJACENT',    'WEEKNIGHT',   1020, 1320),
    ('ACADEMIC_ADJACENT',    'WEEKEND',      540, 1320),
    ('ACADEMIC_ADJACENT',    'EXAM_PERIOD', NULL, NULL),
    -- The library restriction applies all day, not only at night.
    ('LIBRARY_ADJACENT',     'WEEKNIGHT',   NULL, NULL),
    ('LIBRARY_ADJACENT',     'WEEKEND',      720, 1080),
    ('LIBRARY_ADJACENT',     'EXAM_PERIOD', NULL, NULL),
    ('INDOOR_ISOLATED',      'WEEKNIGHT',    480, 1380),
    ('INDOOR_ISOLATED',      'WEEKEND',      480, 1440),
    ('INDOOR_ISOLATED',      'EXAM_PERIOD',  480, 1320)
ON CONFLICT (zone, day_type) DO NOTHING;

-- 2. Sound ceiling and permit lead time per zone.
CREATE TABLE IF NOT EXISTS public.noise_zone_profiles (
    zone TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    ceiling_db SMALLINT NOT NULL CHECK (ceiling_db BETWEEN 40 AND 120),
    receptor_distance_metres SMALLINT NOT NULL CHECK (receptor_distance_metres > 0),
    -- Calendar days, because permit offices publish their deadline in calendar
    -- days and applying different arithmetic than they do would produce a
    -- deadline that is wrong in the direction that matters.
    permit_lead_days SMALLINT NOT NULL CHECK (permit_lead_days >= 0)
);

INSERT INTO public.noise_zone_profiles (zone, label, ceiling_db, receptor_distance_metres, permit_lead_days)
VALUES
    ('OPEN_FIELD',           'Open field / far from buildings', 75, 50, 10),
    ('RESIDENTIAL_ADJACENT', 'Adjacent to residence halls',     60, 20, 14),
    ('ACADEMIC_ADJACENT',    'Adjacent to teaching space',      65, 25, 14),
    ('LIBRARY_ADJACENT',     'Adjacent to the library',         55, 15, 14),
    ('INDOOR_ISOLATED',      'Indoor, acoustically isolated',   90, 30,  0)
ON CONFLICT (zone) DO NOTHING;

-- 3. Which zone a venue sits in. Distance is the real driver, so it is kept
--    alongside the zone rather than being folded into it and lost.
CREATE TABLE IF NOT EXISTS public.venue_noise_profiles (
    venue_id UUID PRIMARY KEY REFERENCES public.venues(id) ON DELETE CASCADE,
    zone TEXT NOT NULL REFERENCES public.noise_zone_profiles(zone),
    nearest_receptor TEXT NOT NULL DEFAULT 'NONE' CHECK (
        nearest_receptor IN ('RESIDENCE', 'LIBRARY', 'ACADEMIC_BUILDING', 'NONE')
    ),
    receptor_distance_metres SMALLINT CHECK (
        receptor_distance_metres IS NULL OR receptor_distance_metres > 0
    ),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. The event's sound plan.
CREATE TABLE IF NOT EXISTS public.event_sound_plans (
    event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    amplified BOOLEAN NOT NULL DEFAULT FALSE,
    -- The venue registry entry this event is using, if it is a known room
    -- rather than an ad-hoc location. events.venue_id points at event_venues,
    -- which is a per-event location row and therefore has no reusable noise
    -- profile to inherit; the zone is a property of the place, not of one
    -- booking of it, so it is looked up here instead.
    venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
    zone TEXT REFERENCES public.noise_zone_profiles(zone),
    source_level_db SMALLINT CHECK (source_level_db IS NULL OR source_level_db BETWEEN 40 AND 140),
    -- Front of house is conventionally quoted at 10 m.
    source_reference_metres SMALLINT NOT NULL DEFAULT 10 CHECK (source_reference_metres > 0),
    receptor_distance_metres SMALLINT CHECK (
        receptor_distance_metres IS NULL OR receptor_distance_metres > 0
    ),
    permit_submitted_at TIMESTAMPTZ,
    permit_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sound_plan_reference_implies_submission CHECK (
        permit_reference IS NULL OR permit_submitted_at IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_event_sound_plan_amplified
    ON public.event_sound_plans (event_id)
    WHERE amplified;

-- 5. Which set of hours applies on a date.
--
--    Exam periods come from the calendar the platform already keeps, so moving
--    an exam period moves the noise restriction with it. Friday and Saturday
--    carry the weekend allowance, since that is the night the extra hour is
--    actually wanted; Sunday does not, because Monday morning follows it.
CREATE OR REPLACE FUNCTION public.noise_day_type(p_day DATE)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM public.academic_calendar_periods p
            WHERE p.period_type IN ('EXAM_PERIOD', 'READING_WEEK')
              AND p_day BETWEEN p.start_date AND p.end_date
        ) THEN 'EXAM_PERIOD'
        WHEN EXTRACT(ISODOW FROM p_day) IN (5, 6) THEN 'WEEKEND'
        ELSE 'WEEKNIGHT'
    END;
$$;

-- 6. Sound level at a distance, given a level quoted at another distance.
--
--    Inverse-square for a point source: 6 dB per doubling. Deliberately an
--    approximation -- it ignores ground effect, barriers and directivity -- and
--    documented as one. It exists to catch the event that is 20 dB over, not
--    to replace an acoustic survey.
CREATE OR REPLACE FUNCTION public.attenuate_db(
    p_source_db NUMERIC,
    p_from_metres NUMERIC,
    p_to_metres NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_from_metres <= 0 OR p_to_metres <= 0 THEN p_source_db
        ELSE p_source_db - 20 * LOG(10, p_to_metres / p_from_metres)
    END;
$$;

-- 7. The last day a permit application can be filed.
CREATE OR REPLACE FUNCTION public.sound_permit_deadline(p_event_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT CASE
        WHEN NOT s.amplified OR z.permit_lead_days = 0 THEN NULL
        ELSE e.start_date - MAKE_INTERVAL(days => z.permit_lead_days)
    END
    FROM public.event_sound_plans s
    JOIN public.events e ON e.id = s.event_id
    JOIN public.noise_zone_profiles z ON z.zone = s.zone
    WHERE s.event_id = p_event_id;
$$;

-- 8. Minutes of the event that fall outside the permitted hours.
--
--    Reporting the overlap rather than a yes/no is the difference between
--    "your event is non-compliant" and "you are ninety minutes over, finish at
--    22:00", and only one of those is something an organiser can act on. An
--    event spanning midnight is evaluated day by day, because the day type can
--    change underneath it.
CREATE OR REPLACE FUNCTION public.sound_non_compliant_minutes(p_event_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    WITH plan AS (
        SELECT s.zone,
               e.start_date AS starts_at,
               COALESCE(e.end_date, e.start_date) AS ends_at
        FROM public.event_sound_plans s
        JOIN public.events e ON e.id = s.event_id
        WHERE s.event_id = p_event_id AND s.amplified
    ),
    days AS (
        SELECT d::DATE AS day, plan.zone, plan.starts_at, plan.ends_at
        FROM plan,
             generate_series(plan.starts_at::DATE, plan.ends_at::DATE, INTERVAL '1 day') AS d
    ),
    permitted AS (
        SELECT
            GREATEST(
                0,
                EXTRACT(EPOCH FROM (
                    LEAST(days.ends_at, days.day + MAKE_INTERVAL(mins => w.end_minute))
                    - GREATEST(days.starts_at, days.day + MAKE_INTERVAL(mins => w.start_minute))
                )) / 60
            ) AS minutes
        FROM days
        JOIN public.noise_zone_windows w
            ON w.zone = days.zone
           AND w.day_type = public.noise_day_type(days.day)
        WHERE w.start_minute IS NOT NULL
    )
    SELECT GREATEST(
        0,
        ROUND(
            (SELECT EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60 FROM plan)
            - COALESCE((SELECT SUM(minutes) FROM permitted), 0)
        )
    )::INTEGER
    FROM plan;
$$;

-- 9. The verdict.
--
--    A missed permit deadline outranks everything else, because it is the only
--    failure here that cannot be fixed by changing the event: an end time can
--    be moved and a PA can be turned down, but last week cannot be revisited.
CREATE OR REPLACE FUNCTION public.event_sound_compliance(p_event_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_plan RECORD;
    v_deadline TIMESTAMPTZ;
    v_over INTEGER;
    v_has_window BOOLEAN;
    v_at_receptor NUMERIC;
BEGIN
    SELECT s.*, e.start_date, z.ceiling_db, z.receptor_distance_metres AS zone_distance,
           z.permit_lead_days
    INTO v_plan
    FROM public.event_sound_plans s
    JOIN public.events e ON e.id = s.event_id
    JOIN public.noise_zone_profiles z ON z.zone = s.zone
    WHERE s.event_id = p_event_id;

    IF v_plan IS NULL OR NOT v_plan.amplified THEN
        RETURN 'COMPLIANT';
    END IF;

    v_deadline := public.sound_permit_deadline(p_event_id);

    IF v_deadline IS NOT NULL
       AND v_plan.permit_submitted_at IS NULL
       AND NOW() > v_deadline THEN
        RETURN 'PERMIT_DEADLINE_MISSED';
    END IF;

    IF v_deadline IS NOT NULL
       AND v_plan.permit_submitted_at IS NOT NULL
       AND v_plan.permit_submitted_at > v_deadline THEN
        RETURN 'PERMIT_DEADLINE_MISSED';
    END IF;

    v_over := public.sound_non_compliant_minutes(p_event_id);

    SELECT w.start_minute IS NOT NULL INTO v_has_window
    FROM public.noise_zone_windows w
    WHERE w.zone = v_plan.zone
      AND w.day_type = public.noise_day_type(v_plan.start_date::DATE);

    IF v_over > 0 AND NOT COALESCE(v_has_window, FALSE) THEN
        RETURN 'PROHIBITED_PERIOD';
    END IF;

    IF v_over > 0 THEN
        RETURN 'EXCEEDS_PERMITTED_HOURS';
    END IF;

    IF v_plan.source_level_db IS NOT NULL THEN
        v_at_receptor := public.attenuate_db(
            v_plan.source_level_db,
            v_plan.source_reference_metres,
            COALESCE(v_plan.receptor_distance_metres, v_plan.zone_distance)
        );

        IF v_at_receptor > v_plan.ceiling_db THEN
            RETURN 'EXCEEDS_SOUND_LIMIT';
        END IF;
    END IF;

    RETURN 'COMPLIANT';
END;
$$;

-- 10. Default the zone from the venue when a sound plan is created.
--
--     An organiser knows they are using a PA; they do not necessarily know
--     their lawn is twenty metres from a residence hall. Asking them to pick a
--     zone by hand would just record the wrong zone.
CREATE OR REPLACE FUNCTION public.default_sound_plan_zone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.zone IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.venue_id IS NOT NULL THEN
        SELECT vn.zone INTO NEW.zone
        FROM public.venue_noise_profiles vn
        WHERE vn.venue_id = NEW.venue_id;
    END IF;

    -- An unknown location falls back to the most permissive zone rather than
    -- the strictest. Guessing strict on a field nobody lives near would train
    -- organisers to override the zone by hand, and an overridden zone is a
    -- worse outcome than a permissive default that the permit office corrects.
    NEW.zone := COALESCE(NEW.zone, 'OPEN_FIELD');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_default_sound_plan_zone ON public.event_sound_plans;
CREATE TRIGGER trg_default_sound_plan_zone
    BEFORE INSERT ON public.event_sound_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.default_sound_plan_zone();

-- 11. Amplified events whose permit deadline is approaching or gone, so the
--     application is chased rather than discovered too late.
CREATE OR REPLACE FUNCTION public.get_sound_permits_due(p_within_days INTEGER DEFAULT 7)
RETURNS TABLE (
    event_id UUID,
    zone TEXT,
    deadline TIMESTAMPTZ,
    days_remaining INTEGER,
    status TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        s.event_id,
        s.zone,
        public.sound_permit_deadline(s.event_id),
        EXTRACT(DAY FROM public.sound_permit_deadline(s.event_id) - NOW())::INTEGER,
        CASE
            WHEN s.permit_submitted_at IS NOT NULL THEN 'SUBMITTED'
            WHEN public.sound_permit_deadline(s.event_id) < NOW() THEN 'DEADLINE_PASSED'
            ELSE 'OUTSTANDING'
        END
    FROM public.event_sound_plans s
    WHERE s.amplified
      AND s.permit_submitted_at IS NULL
      AND public.sound_permit_deadline(s.event_id) IS NOT NULL
      AND public.sound_permit_deadline(s.event_id)
          <= NOW() + (p_within_days || ' days')::INTERVAL
    ORDER BY public.sound_permit_deadline(s.event_id) ASC, s.event_id ASC;
$$;

-- 12. Row level security. None of this is personal data, but the zone tables
--     are campus policy and must not be editable by an organiser who finds
--     their curfew inconvenient.
ALTER TABLE public.noise_zone_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noise_zone_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_noise_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sound_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Noise windows are readable" ON public.noise_zone_windows;
CREATE POLICY "Noise windows are readable"
    ON public.noise_zone_windows FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Noise profiles are readable" ON public.noise_zone_profiles;
CREATE POLICY "Noise profiles are readable"
    ON public.noise_zone_profiles FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Venue noise profiles are readable" ON public.venue_noise_profiles;
CREATE POLICY "Venue noise profiles are readable"
    ON public.venue_noise_profiles FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Sound plans are readable" ON public.event_sound_plans;
CREATE POLICY "Sound plans are readable"
    ON public.event_sound_plans FOR SELECT
    TO authenticated
    USING (TRUE);

COMMENT ON TABLE public.noise_zone_windows IS
    'Permitted amplified sound hours by zone and day type. A null window means prohibited outright (#3399).';
COMMENT ON FUNCTION public.noise_day_type IS
    'Weeknight, weekend or exam period for a date, reading exam periods from academic_calendar_periods rather than restating them.';
COMMENT ON FUNCTION public.sound_non_compliant_minutes IS
    'Minutes of the event falling outside permitted hours, evaluated day by day so an event crossing midnight is measured correctly.';
COMMENT ON FUNCTION public.attenuate_db IS
    'Inverse-square attenuation, 6 dB per doubling of distance. An approximation for screening, not an acoustic survey.';
