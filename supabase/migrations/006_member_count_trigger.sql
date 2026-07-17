-- ============================================================
-- Migration: 003_member_count_trigger.sql
-- Description:
-- Adds a cached member_count column to the clubs table and
-- keeps it automatically synchronized using PostgreSQL triggers
-- whenever members are added or removed.
-- ============================================================

-- ------------------------------------------------------------
-- Add cached member_count column
-- ------------------------------------------------------------

ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS member_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN clubs.member_count IS
'Stores the cached number of members in a club for faster queries.';

-- ------------------------------------------------------------
-- Populate member_count for existing data
-- ------------------------------------------------------------

UPDATE clubs
SET member_count = (
    SELECT COUNT(*)
    FROM club_members
    WHERE club_members.club_id = clubs.id
);

-- ------------------------------------------------------------
-- Trigger functions
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Function: Increment member count
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_member_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE clubs
    SET member_count = member_count + 1
    WHERE id = NEW.club_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Function: Decrement member count
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION decrement_member_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE clubs
    SET member_count = GREATEST(member_count - 1, 0)
    WHERE id = OLD.club_id;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Trigger: Increment member count after insert
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS on_member_added ON club_members;

CREATE TRIGGER on_member_added
AFTER INSERT ON club_members
FOR EACH ROW
EXECUTE FUNCTION increment_member_count();

-- ------------------------------------------------------------
-- Trigger: Decrement member count after delete
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS on_member_removed ON club_members;

CREATE TRIGGER on_member_removed
AFTER DELETE ON club_members
FOR EACH ROW
EXECUTE FUNCTION decrement_member_count();

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------