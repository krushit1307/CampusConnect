-- =============================================================================
-- Migration: 20261231000026_festival_multi_track_roadmap.sql
-- Issue: #3944 - Build an 'Interactive "Event Roadmap" for Multi-Day Festivals'
-- Description: Schema for multi-track conference tracks, concurrent sessions,
--              user personalized itineraries, and schedule queries.
-- =============================================================================

-- 1. Conference Tracks Table
CREATE TABLE IF NOT EXISTS public.festival_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    short_code TEXT NOT NULL,
    color_hex TEXT NOT NULL DEFAULT '#3B82F6',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Conference Sessions Table
CREATE TABLE IF NOT EXISTS public.festival_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    track_id UUID REFERENCES public.festival_tracks(id) ON DELETE SET NULL,
    day_number INT NOT NULL DEFAULT 1,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    title TEXT NOT NULL,
    abstract TEXT,
    venue_room TEXT NOT NULL,
    building_name TEXT NOT NULL,
    capacity INT NOT NULL DEFAULT 100,
    current_rsvp_count INT NOT NULL DEFAULT 0,
    speakers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_keynote BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_festival_sessions_event_id ON public.festival_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_festival_sessions_track_id ON public.festival_sessions(track_id);
CREATE INDEX IF NOT EXISTS idx_festival_sessions_day ON public.festival_sessions(day_number);

-- 3. User Personalized Festival Itineraries Table
CREATE TABLE IF NOT EXISTS public.user_festival_itineraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    festival_event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    session_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_festival_itinerary UNIQUE (user_id, festival_event_id)
);

-- 4. Row Level Security
ALTER TABLE public.festival_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_festival_itineraries ENABLE ROW LEVEL SECURITY;

-- Public can view tracks and sessions
CREATE POLICY "Public can view festival tracks" ON public.festival_tracks FOR SELECT USING (true);
CREATE POLICY "Public can view festival sessions" ON public.festival_sessions FOR SELECT USING (true);

-- Users can manage their own personal itineraries
CREATE POLICY "Users can manage their personal itineraries"
    ON public.user_festival_itineraries
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 5. Stored Procedure: Fetch Full Festival Schedule Matrix
CREATE OR REPLACE FUNCTION public.get_festival_roadmap_rpc(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tracks JSONB;
    v_sessions JSONB;
    v_result JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    INTO v_tracks
    FROM public.festival_tracks t
    WHERE t.event_id = p_event_id;

    SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    INTO v_sessions
    FROM public.festival_sessions s
    WHERE s.event_id = p_event_id
    ORDER BY s.day_number, s.start_time;

    v_result := jsonb_build_object(
        'event_id', p_event_id,
        'tracks', v_tracks,
        'sessions', v_sessions
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_festival_roadmap_rpc TO authenticated, anon;
