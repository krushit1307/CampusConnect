-- ============================================================
-- Migration: 20260716000023_validate_event_date.sql
-- Description:
-- Prevents organizers from creating events with a past event_date.
-- ============================================================

-- ------------------------------------------------------------
-- Trigger function
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Function: Validate event date
-- ------------------------------------------------------------

DROP FUNCTION IF EXISTS validate_event_date() CASCADE;

CREATE OR REPLACE FUNCTION validate_event_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.event_date IS NOT NULL AND NEW.event_date <= NOW() THEN
        RAISE EXCEPTION 'Event date must be in the future.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Trigger: Validate event date before insert
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_validate_event_date ON events;

CREATE TRIGGER trg_validate_event_date
BEFORE INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION validate_event_date();

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------
