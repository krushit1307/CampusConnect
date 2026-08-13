-- Migration: 20260903000000_event_sustainability_scorecard.sql
-- Description: Issue #3134 - Event Sustainability Scorecard with Carbon Footprint Estimation

-- 1. Raw sustainability inputs captured per event.
--    Kept as JSONB arrays because the shape of a travel/catering/materials line
--    is owned by src/lib/sustainabilityScorecard.ts and evolves with the
--    emission factor set, not with the database schema.
CREATE TABLE IF NOT EXISTS public.event_sustainability_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    expected_attendees INTEGER NOT NULL DEFAULT 0 CHECK (expected_attendees >= 0),
    travel_legs JSONB NOT NULL DEFAULT '[]'::JSONB,
    catering_lines JSONB NOT NULL DEFAULT '[]'::JSONB,
    material_lines JSONB NOT NULL DEFAULT '[]'::JSONB,
    venue_floor_area_sqm NUMERIC(10, 2) CHECK (venue_floor_area_sqm IS NULL OR venue_floor_area_sqm >= 0),
    venue_duration_hours NUMERIC(6, 2) CHECK (venue_duration_hours IS NULL OR venue_duration_hours >= 0),
    venue_renewable_energy BOOLEAN NOT NULL DEFAULT FALSE,
    recycling_provided BOOLEAN NOT NULL DEFAULT FALSE,
    compost_provided BOOLEAN NOT NULL DEFAULT FALSE,
    measured_diversion_rate NUMERIC(4, 3) CHECK (
        measured_diversion_rate IS NULL
        OR (measured_diversion_rate >= 0 AND measured_diversion_rate <= 1)
    ),
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT event_sustainability_inputs_event_unique UNIQUE (event_id)
);

-- 2. Cached scorecard results. The engine is deterministic, so this is a cache
--    rather than a source of truth: it exists so leaderboard and reporting
--    queries do not have to recompute every event on every read.
CREATE TABLE IF NOT EXISTS public.event_sustainability_scores (
    event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    total_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
    per_attendee_kg NUMERIC(10, 3) NOT NULL DEFAULT 0,
    grade CHAR(1) NOT NULL DEFAULT 'A' CHECK (grade IN ('A', 'B', 'C', 'D', 'E', 'F')),
    travel_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
    catering_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
    materials_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
    venue_kg NUMERIC(12, 3) NOT NULL DEFAULT 0,
    largest_contributor TEXT,
    recommendations JSONB NOT NULL DEFAULT '[]'::JSONB,
    -- Factor set version, so a historical score can be explained even after the
    -- annual DEFRA refresh changes the numbers underneath it.
    factor_set_version TEXT NOT NULL DEFAULT 'defra-2024',
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sustainability_scores_grade
    ON public.event_sustainability_scores (grade);

CREATE INDEX IF NOT EXISTS idx_sustainability_scores_per_attendee
    ON public.event_sustainability_scores (per_attendee_kg);

-- 3. Keep updated_at honest on the inputs table.
CREATE OR REPLACE FUNCTION public.touch_event_sustainability_inputs()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_event_sustainability_inputs
    ON public.event_sustainability_inputs;

CREATE TRIGGER trg_touch_event_sustainability_inputs
    BEFORE UPDATE ON public.event_sustainability_inputs
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_event_sustainability_inputs();

-- 4. Persist a computed scorecard. The arithmetic lives in TypeScript; this
--    function only stores the result so the client and any future server-side
--    job cannot drift apart on the emission factors.
CREATE OR REPLACE FUNCTION public.upsert_event_sustainability_score(
    p_event_id UUID,
    p_total_kg NUMERIC,
    p_per_attendee_kg NUMERIC,
    p_grade CHAR(1),
    p_travel_kg NUMERIC,
    p_catering_kg NUMERIC,
    p_materials_kg NUMERIC,
    p_venue_kg NUMERIC,
    p_largest_contributor TEXT,
    p_recommendations JSONB DEFAULT '[]'::JSONB,
    p_factor_set_version TEXT DEFAULT 'defra-2024'
)
RETURNS public.event_sustainability_scores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.event_sustainability_scores;
BEGIN
    INSERT INTO public.event_sustainability_scores AS s (
        event_id, total_kg, per_attendee_kg, grade,
        travel_kg, catering_kg, materials_kg, venue_kg,
        largest_contributor, recommendations, factor_set_version, computed_at
    )
    VALUES (
        p_event_id, p_total_kg, p_per_attendee_kg, p_grade,
        p_travel_kg, p_catering_kg, p_materials_kg, p_venue_kg,
        p_largest_contributor, p_recommendations, p_factor_set_version, NOW()
    )
    ON CONFLICT (event_id) DO UPDATE SET
        total_kg = EXCLUDED.total_kg,
        per_attendee_kg = EXCLUDED.per_attendee_kg,
        grade = EXCLUDED.grade,
        travel_kg = EXCLUDED.travel_kg,
        catering_kg = EXCLUDED.catering_kg,
        materials_kg = EXCLUDED.materials_kg,
        venue_kg = EXCLUDED.venue_kg,
        largest_contributor = EXCLUDED.largest_contributor,
        recommendations = EXCLUDED.recommendations,
        factor_set_version = EXCLUDED.factor_set_version,
        computed_at = NOW()
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

-- 5. Club-level rollup for end-of-semester reporting. Averaging the
--    per-attendee figure (rather than dividing club totals by club headcount)
--    stops a club improving its grade by simply running fewer, larger events.
CREATE OR REPLACE FUNCTION public.get_club_sustainability_summary(p_club_id UUID)
RETURNS TABLE (
    event_count BIGINT,
    total_kg NUMERIC,
    average_per_attendee_kg NUMERIC,
    grade CHAR(1)
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    WITH club_scores AS (
        SELECT s.total_kg, s.per_attendee_kg
        FROM public.event_sustainability_scores s
        JOIN public.events e ON e.id = s.event_id
        WHERE e.club_id = p_club_id
    ),
    aggregated AS (
        SELECT
            COUNT(*) AS event_count,
            COALESCE(SUM(total_kg), 0) AS total_kg,
            COALESCE(AVG(per_attendee_kg), 0) AS average_per_attendee_kg
        FROM club_scores
    )
    SELECT
        a.event_count,
        ROUND(a.total_kg, 3) AS total_kg,
        ROUND(a.average_per_attendee_kg, 3) AS average_per_attendee_kg,
        CASE
            WHEN a.average_per_attendee_kg <= 2 THEN 'A'
            WHEN a.average_per_attendee_kg <= 5 THEN 'B'
            WHEN a.average_per_attendee_kg <= 10 THEN 'C'
            WHEN a.average_per_attendee_kg <= 20 THEN 'D'
            WHEN a.average_per_attendee_kg <= 40 THEN 'E'
            ELSE 'F'
        END::CHAR(1) AS grade
    FROM aggregated a;
$$;

-- 6. Row level security.
ALTER TABLE public.event_sustainability_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sustainability_scores ENABLE ROW LEVEL SECURITY;

-- Scores are published alongside the event itself, so anyone who can see the
-- event can see its grade. That visibility is the point of the feature.
DROP POLICY IF EXISTS "Sustainability scores are publicly readable"
    ON public.event_sustainability_scores;
CREATE POLICY "Sustainability scores are publicly readable"
    ON public.event_sustainability_scores
    FOR SELECT
    USING (TRUE);

-- Raw inputs are only editable by the organiser who owns the event.
DROP POLICY IF EXISTS "Organisers manage their own sustainability inputs"
    ON public.event_sustainability_inputs;
CREATE POLICY "Organisers manage their own sustainability inputs"
    ON public.event_sustainability_inputs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.events e
            WHERE e.id = event_sustainability_inputs.event_id
              AND e.created_by = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.events e
            WHERE e.id = event_sustainability_inputs.event_id
              AND e.created_by = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Sustainability inputs are readable by signed in users"
    ON public.event_sustainability_inputs;
CREATE POLICY "Sustainability inputs are readable by signed in users"
    ON public.event_sustainability_inputs
    FOR SELECT
    USING (auth.role() = 'authenticated');

COMMENT ON TABLE public.event_sustainability_inputs IS
    'Raw per-event sustainability declarations feeding the scorecard engine (#3134).';
COMMENT ON TABLE public.event_sustainability_scores IS
    'Cached CO2e scorecard results. Recomputable from event_sustainability_inputs.';
