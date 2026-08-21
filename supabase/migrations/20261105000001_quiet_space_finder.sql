-- =============================================================================
-- Migration: Dynamic "Quiet Space" Finder for Events
-- Issue: #3555 - Develop a 'Dynamic "Quiet Space" Finder for Events'
-- Description: Adds columns to the events table to designate and describe
-- quiet decompression zones for neurodivergent attendees at large events.
-- =============================================================================

-- 1. Add quiet space columns to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS quiet_space_location TEXT,
ADD COLUMN IF NOT EXISTS quiet_space_description TEXT,
ADD COLUMN IF NOT EXISTS quiet_space_photo_url TEXT,
ADD COLUMN IF NOT EXISTS requires_quiet_space BOOLEAN GENERATED ALWAYS AS (capacity >= 500) STORED;

COMMENT ON COLUMN public.events.quiet_space_location IS 'Physical location or room name of the designated quiet space.';
COMMENT ON COLUMN public.events.quiet_space_description IS 'Written directions to find the quiet space from the main event area.';
COMMENT ON COLUMN public.events.quiet_space_photo_url IS 'URL to a photo of the door or entrance to help attendees identify it.';
COMMENT ON COLUMN public.events.requires_quiet_space IS 'Automatically true if event capacity is 500 or more.';

-- 2. Create index for fast querying of large events
CREATE INDEX IF NOT EXISTS idx_events_requires_quiet_space 
ON public.events(requires_quiet_space) 
WHERE requires_quiet_space = TRUE;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
-- Assuming existing RLS policies on the events table cover these new columns.
-- No additional policies needed as these are public event details.
