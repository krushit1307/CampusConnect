-- Table to hold uploaded live stream media records
CREATE TABLE IF NOT EXISTS public.event_live_stream_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    moderation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shadowbanned users table to prevent troll uploads
CREATE TABLE IF NOT EXISTS public.shadowbanned_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for live projector queries
CREATE INDEX idx_live_stream_event_status ON public.event_live_stream_media(event_id, status, created_at DESC);

-- Enable Supabase Realtime Replication on event_live_stream_media
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_live_stream_media;

-- RLS Policies
ALTER TABLE public.event_live_stream_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadowbanned_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved media"
    ON public.event_live_stream_media FOR SELECT
    USING (status = 'approved');

CREATE POLICY "Authenticated users can upload media"
    ON public.event_live_stream_media FOR INSERT
    WITH CHECK (auth.uid() = user_id);
