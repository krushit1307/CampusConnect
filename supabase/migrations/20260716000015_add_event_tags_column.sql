-- ============================================================
-- Migration: 20260716000015_add_event_tags_column.sql
-- Description:
-- Adds tags array column to events for keyword-based searching.
-- ============================================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_events_tags
ON events
USING GIN (tags);