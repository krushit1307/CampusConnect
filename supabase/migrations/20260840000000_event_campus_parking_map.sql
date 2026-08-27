-- Migration: 20260840000000_event_campus_parking_map.sql
-- Description: Designated event campus parking lots with real-time occupancy and navigation (#3537)

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS designated_parking_lots JSONB DEFAULT '[]'::jsonb;

-- Index for designated parking queries
CREATE INDEX IF NOT EXISTS idx_events_parking_lots ON public.events USING GIN (designated_parking_lots);

COMMENT ON COLUMN public.events.designated_parking_lots IS 'JSON array of designated parking lots with GPS coordinates, occupancy, and entrance locations for event logistics';
