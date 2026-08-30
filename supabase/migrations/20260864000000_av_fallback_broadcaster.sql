-- Migration: 20260864000000_av_fallback_broadcaster.sql
-- Description: Real-Time Audio/Visual Check Fallback Broadcaster with WebRTC source swapping (#4668)

CREATE TABLE IF NOT EXISTS public.live_broadcast_fallback_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  fallback_slate_url TEXT NOT NULL DEFAULT 'https://cdn.campus.edu/slates/starting_soon_fallback.mp4',
  presenter_ping_passed BOOLEAN DEFAULT false,
  active_broadcast_source TEXT NOT NULL DEFAULT 'fallback_slate', -- 'fallback_slate', 'live_webrtc'
  crossfade_duration_ms INT DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'broadcasting_fallback', -- 'broadcasting_fallback', 'cut_to_live', 'offline'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for broadcast fallback lookup
CREATE INDEX IF NOT EXISTS idx_live_broadcast_fallback_event ON public.live_broadcast_fallback_sessions(event_id);

-- Enable RLS
ALTER TABLE public.live_broadcast_fallback_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read live broadcast fallback sessions"
ON public.live_broadcast_fallback_sessions FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage live broadcast fallback sessions"
ON public.live_broadcast_fallback_sessions FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.live_broadcast_fallback_sessions TO authenticated, anon;
