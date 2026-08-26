-- ============================================================
-- Migration: 20260716000017_track_handle_history.sql
-- Description:
-- Tracks profile handle changes by storing previous handles.
-- ============================================================

CREATE TABLE IF NOT EXISTS handle_history (
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    old_handle TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION log_handle_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.handle IS DISTINCT FROM NEW.handle THEN
        INSERT INTO handle_history (
            profile_id,
            old_handle,
            changed_at
        )
        VALUES (
            OLD.id,
            OLD.handle,
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_handle_changes ON profiles;

CREATE TRIGGER track_handle_changes
AFTER UPDATE OF handle ON profiles
FOR EACH ROW
EXECUTE FUNCTION log_handle_change();