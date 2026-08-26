-- Add virtual tour 360 panorama fields to events/venues
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS panorama_url TEXT,
ADD COLUMN IF NOT EXISTS is_360_viewable BOOLEAN DEFAULT FALSE NOT NULL;

-- Index for fast lookups on virtual tour enabled events
CREATE INDEX IF NOT EXISTS idx_events_360 ON events(is_360_viewable) WHERE is_360_viewable = TRUE;