-- ============================================================
-- Migration: Dynamic EventProgressBar lead time (#980)
-- Description:
--  1. Adds an explicit `announce_date` column to events so the
--     progress window can use the real announcement timestamp
--     instead of assuming every event was created exactly 30
--     days before its date.
--  2. Adds a cached `average_lead_time_days` column to clubs,
--     kept in sync by triggers, so cards without an announce
--     date can fall back to that club's historical average.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add events.announce_date (explicit announcement timestamp)
-- ------------------------------------------------------------

ALTER TABLE events
ADD COLUMN IF NOT EXISTS announce_date TIMESTAMPTZ;

COMMENT ON COLUMN events.announce_date IS
'The date the event was announced. Defaults to created_at on insert.';

-- ------------------------------------------------------------
-- 2. Add clubs.average_lead_time_days (cached per-club average)
-- ------------------------------------------------------------

ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS average_lead_time_days NUMERIC(8, 2);

COMMENT ON COLUMN clubs.average_lead_time_days IS
'Cached average days between announce_date and event_date for a club.';

-- ------------------------------------------------------------
-- 3. Backfill announce_date from created_at for existing events
-- ------------------------------------------------------------

UPDATE events
SET announce_date = created_at
WHERE announce_date IS NULL AND created_at IS NOT NULL;

-- ------------------------------------------------------------
-- 4. Trigger function: default announce_date to created_at
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_event_announce_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.announce_date := COALESCE(NEW.announce_date, NEW.created_at, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 5. Recalculate a club's average lead time
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recalculate_club_lead_time(p_club_id UUID)
RETURNS NUMERIC(8, 2) AS $$
DECLARE
    avg_days NUMERIC(8, 2);
BEGIN
    SELECT ROUND(
        AVG(EXTRACT(EPOCH FROM (event_date - COALESCE(announce_date, created_at))) / 86400.0)::NUMERIC,
        2
    )
    INTO avg_days
    FROM events
    WHERE club_id = p_club_id
      AND event_date IS NOT NULL
      AND event_date > COALESCE(announce_date, created_at);

    UPDATE clubs
    SET average_lead_time_days = avg_days
    WHERE id = p_club_id;

    RETURN avg_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- 6. Trigger function: refresh the club average on event changes
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_club_lead_time()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.recalculate_club_lead_time(COALESCE(NEW.club_id, OLD.club_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- 7. Triggers
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS on_event_set_announce_date ON events;

CREATE TRIGGER on_event_set_announce_date
BEFORE INSERT ON events
FOR EACH ROW EXECUTE FUNCTION public.set_event_announce_date();

DROP TRIGGER IF EXISTS on_event_refresh_club_lead_time ON events;

CREATE TRIGGER on_event_refresh_club_lead_time
AFTER INSERT OR UPDATE OR DELETE ON events
FOR EACH ROW EXECUTE FUNCTION public.refresh_club_lead_time();

-- ------------------------------------------------------------
-- 8. Backfill club averages for existing clubs
-- ------------------------------------------------------------

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM clubs LOOP
        PERFORM public.recalculate_club_lead_time(r.id);
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------
