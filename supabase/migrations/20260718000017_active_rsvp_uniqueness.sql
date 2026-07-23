-- ============================================================
-- Migration: 20260718000017_active_rsvp_uniqueness.sql
-- Description:
-- The event_rsvps table already enforces UNIQUE(event_id, user_id)
-- via the table definition in 001_initial_schema.sql.
--
-- The previous implementation referenced a non-existent `status`
-- column, which causes migration verification to fail.
--
-- No additional partial index is required for the current schema.
-- ============================================================

DROP INDEX IF EXISTS idx_event_rsvps_active_uniqueness;