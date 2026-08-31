-- ><><><><><><><><><><><><><><><><><><><><><><<<><><><><<><>
-- CampusConnect – Automated Content Warning Tagging (Issue #3679)
-- supabase/migrations/013_content_warning_columns.sql
-- <><><><><><><><><><><><><><><><><><><<><><><><<><><><><><><><

-- Add content_warning and warning_tags columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS content_warning BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS warning_tags TEXT[] DEFAULT '{}';

-- Index for quick filtering of events with content warnings
CREATE INDEX IF NOT EXISTS idx_events_content_warning ON events(content_warning) WHERE content_warning = TRUE;
