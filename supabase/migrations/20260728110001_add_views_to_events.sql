-- Migration: Add views column to events table
-- Description: Adds a 'views' column to track how many times an event page has been viewed,
-- which is a key component of the popularity score calculation.

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;

-- Add an index to speed up sorting by views if needed independently
CREATE INDEX IF NOT EXISTS idx_events_views ON public.events (views DESC);

COMMENT ON COLUMN public.events.views IS 'Total number of times the event details page has been viewed.';
