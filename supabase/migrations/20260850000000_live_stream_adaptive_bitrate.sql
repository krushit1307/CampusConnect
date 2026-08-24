-- Migration: 20260850000000_live_stream_adaptive_bitrate.sql
-- Description: Real-Time Dynamic Video Quality Degradation for live streams (#3586)

CREATE TABLE IF NOT EXISTS public.live_streams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  stream_title TEXT NOT NULL,
  master_m3u8_url TEXT NOT NULL,
  available_resolutions TEXT[] DEFAULT '{"1080p", "720p", "480p", "360p"}',
  is_live BOOLEAN DEFAULT true,
  current_viewers INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for event live stream lookup
CREATE INDEX IF NOT EXISTS idx_live_streams_event ON public.live_streams(event_id);

-- Enable RLS
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read live streams"
ON public.live_streams FOR SELECT
USING (true);

CREATE POLICY "Event organizers manage live streams"
ON public.live_streams FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.live_streams TO authenticated, anon;
