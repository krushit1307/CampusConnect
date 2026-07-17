-- ============================================================
-- Migration: 003_event_start_end_dates.sql
-- Description:
-- Adds start_date and end_date columns to events, required by
-- the new "Create Event" form validation (issue #66). end_date
-- must be logically after start_date, enforced both client-side
-- (zod) and here as a database-level safety net.
-- ============================================================

ALTER TABLE events
ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- ------------------------------------------------------------
-- Backfill existing rows so pre-existing events (which only
-- have event_date set) don't end up with a null start_date.
-- ------------------------------------------------------------

UPDATE events
SET start_date = event_date
WHERE start_date IS NULL AND event_date IS NOT NULL;

-- ------------------------------------------------------------
-- Database-level guard: end_date must be after start_date
-- whenever both are present.
-- ------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_events_end_after_start'
          AND conrelid = 'events'::regclass
    ) THEN
        ALTER TABLE events
        ADD CONSTRAINT chk_events_end_after_start
        CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date);
    END IF;
END $$;

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------
