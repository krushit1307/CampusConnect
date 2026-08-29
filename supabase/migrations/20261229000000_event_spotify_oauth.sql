-- Migration: 20261229000000_event_spotify_oauth.sql
-- Description: Create event_spotify_auth table and downvoting tables for collaborative playlist

-- 1. Create event_spotify_auth table for storing linked Spotify Premium account tokens
CREATE TABLE IF NOT EXISTS public.event_spotify_auth (
    event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_injected_track_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Add downvotes and played columns to song_requests if not exists
ALTER TABLE public.song_requests
ADD COLUMN IF NOT EXISTS downvotes INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS played BOOLEAN DEFAULT FALSE NOT NULL;

-- 3. Create song_downvotes table for downvoting architecture
CREATE TABLE IF NOT EXISTS public.song_downvotes (
    song_request_id UUID NOT NULL REFERENCES public.song_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (song_request_id, user_id)
);

-- Enable RLS
ALTER TABLE public.event_spotify_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_downvotes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_spotify_auth
DROP POLICY IF EXISTS "Spotify auth viewable by event organizer" ON public.event_spotify_auth;
CREATE POLICY "Spotify auth viewable by event organizer"
    ON public.event_spotify_auth FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_spotify_auth.event_id
              AND e.organizer_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Spotify auth modifiable by event organizer" ON public.event_spotify_auth;
CREATE POLICY "Spotify auth modifiable by event organizer"
    ON public.event_spotify_auth FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_spotify_auth.event_id
              AND e.organizer_id = auth.uid()
        )
    );

-- RLS Policies for song_downvotes
DROP POLICY IF EXISTS "Downvotes viewable by everyone" ON public.song_downvotes;
CREATE POLICY "Downvotes viewable by everyone"
    ON public.song_downvotes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can downvote" ON public.song_downvotes;
CREATE POLICY "Authenticated users can downvote"
    ON public.song_downvotes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their downvotes" ON public.song_downvotes;
CREATE POLICY "Users can remove their downvotes"
    ON public.song_downvotes FOR DELETE TO authenticated USING (auth.uid() = user_id);
