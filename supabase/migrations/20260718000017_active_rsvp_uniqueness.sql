-- ============================================================
-- Migration: 20260718000017_active_rsvp_uniqueness.sql
-- Description:
-- Creates a partial unique index on the event_rsvps table to
-- enforce uniqueness of (event_id, user_id) only when status is active.
-- ============================================================

-- ------------------------------------------------------------
-- Drop existing partial index if it exists
-- ------------------------------------------------------------
DROP INDEX IF EXISTS idx_event_rsvps_active_uniqueness;

-- ------------------------------------------------------------
-- Create partial unique index
-- ------------------------------------------------------------
CREATE UNIQUE INDEX idx_event_rsvps_active_uniqueness
ON event_rsvps (event_id, user_id)
WHERE status = 'active';

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------
