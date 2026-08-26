-- Function to update club activity timestamp
CREATE OR REPLACE FUNCTION update_club_activity_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved'
       AND (
            TG_OP = 'INSERT'
            OR OLD.status IS DISTINCT FROM NEW.status
       )
    THEN
        UPDATE clubs
        SET updated_at = NOW()
        WHERE id = NEW.club_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS trigger_update_club_activity
ON club_members;

CREATE TRIGGER trigger_update_club_activity
AFTER INSERT OR UPDATE
ON club_members
FOR EACH ROW
EXECUTE FUNCTION update_club_activity_timestamp();
