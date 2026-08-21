-- Migration: 20260910000000_live_dj_request_system.sql
-- Description: Issue #3462 - Build an 'Interactive Live DJ Request System'

-- 1. Create event_song_requests table
CREATE TABLE IF NOT EXISTS public.event_song_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    song_title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album_art_url TEXT,
    upvotes INT NOT NULL DEFAULT 1,
    played BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for live sorting by upvotes and event
CREATE INDEX IF NOT EXISTS idx_event_song_requests_event_upvotes
    ON public.event_song_requests (event_id, played, upvotes DESC, created_at ASC);

-- 2. Create event_song_request_upvotes join table for upvoting system (Issue #3272)
CREATE TABLE IF NOT EXISTS public.event_song_request_upvotes (
    request_id UUID NOT NULL REFERENCES public.event_song_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (request_id, user_id)
);

-- Enable RLS
ALTER TABLE public.event_song_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_song_request_upvotes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_song_requests
DROP POLICY IF EXISTS "Song requests readable by authenticated users" ON public.event_song_requests;
CREATE POLICY "Song requests readable by authenticated users"
    ON public.event_song_requests FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Song requests insertable by authenticated users" ON public.event_song_requests;
CREATE POLICY "Song requests insertable by authenticated users"
    ON public.event_song_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Song requests updatable by authenticated users" ON public.event_song_requests;
CREATE POLICY "Song requests updatable by authenticated users"
    ON public.event_song_requests FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Song requests deletable by authenticated users" ON public.event_song_requests;
CREATE POLICY "Song requests deletable by authenticated users"
    ON public.event_song_requests FOR DELETE TO authenticated USING (true);

-- RLS Policies for event_song_request_upvotes
DROP POLICY IF EXISTS "Upvotes readable by authenticated users" ON public.event_song_request_upvotes;
CREATE POLICY "Upvotes readable by authenticated users"
    ON public.event_song_request_upvotes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Upvotes insertable by authenticated users" ON public.event_song_request_upvotes;
CREATE POLICY "Upvotes insertable by authenticated users"
    ON public.event_song_request_upvotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Upvotes deletable by authenticated users" ON public.event_song_request_upvotes;
CREATE POLICY "Upvotes deletable by authenticated users"
    ON public.event_song_request_upvotes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_song_requests;
