-- ============================================================
-- Migration: 20260824000002_recurring_events.sql
-- Description:
--   Adds RRULE (RFC 5545) recurrence support to events.
--   A single "parent" event carries the recurrence_rule string.
--   Individual instances link back via parent_event_id and can
--   override location/title for specific dates if needed.
-- ============================================================

-- 1. Add columns to the existing events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
  -- Standard RRULE string, e.g. "FREQ=WEEKLY;BYDAY=TU;COUNT=15"
  ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  -- NULL for parent events; set on each generated instance
  ADD COLUMN IF NOT EXISTS recurrence_index INTEGER;
-- 0-based index of this instance within the series (parent has NULL)

CREATE INDEX IF NOT EXISTS idx_events_parent_event_id ON events(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_events_recurrence_rule ON events(recurrence_rule) WHERE recurrence_rule IS NOT NULL;

-- 2. A view that surfaces upcoming instances for a recurring series
--    (parent events + their un-cancelled future children)
CREATE OR REPLACE VIEW recurring_event_instances AS
SELECT
  e.*,
  COALESCE(p.title, e.title) AS effective_title,
  COALESCE(p.location, e.location) AS effective_location,
  COALESCE(p.banner_url, e.banner_url) AS effective_banner_url,
  p.recurrence_rule AS series_rule,
  p.id AS series_parent_id
FROM events e
LEFT JOIN events p ON e.parent_event_id = p.id
WHERE e.parent_event_id IS NULL  -- parent events
   OR e.event_date >= NOW();     -- or future instances

GRANT SELECT ON recurring_event_instances TO authenticated;
