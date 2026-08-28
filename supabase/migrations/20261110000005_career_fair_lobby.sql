-- =============================================================================
-- Migration: Interactive "Virtual Career Fair" Spatial Lobby
-- Issue: #3687 - Build an 'Interactive "Virtual Career Fair" Spatial Lobby'
-- Description: Defines sponsor booth bounding boxes on the digital fair map
-- and lobby dimensions on the event. Proximity to a booth triggers WebRTC.
-- =============================================================================

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS lobby_width_ft NUMERIC NOT NULL DEFAULT 120,
ADD COLUMN IF NOT EXISTS lobby_height_ft NUMERIC NOT NULL DEFAULT 80;

CREATE TABLE IF NOT EXISTS public.career_fair_booths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sponsor_name TEXT NOT NULL,
  x_ft NUMERIC NOT NULL,
  y_ft NUMERIC NOT NULL,
  width_ft NUMERIC NOT NULL DEFAULT 12,
  height_ft NUMERIC NOT NULL DEFAULT 10,
  logo_url TEXT,
  video_room_name TEXT NOT NULL, -- WebRTC room identifier for this booth
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fair_booths_event ON public.career_fair_booths(event_id);

ALTER TABLE public.career_fair_booths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view fair booths"
ON public.career_fair_booths FOR SELECT USING (true);

CREATE POLICY "Organizers manage fair booths"
ON public.career_fair_booths FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.club_members cm ON e.club_id = cm.club_id
    WHERE e.id = career_fair_booths.event_id
      AND cm.user_id = auth.uid() AND cm.role IN ('admin', 'president')
  )
);
