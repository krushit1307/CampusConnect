-- Migration: add trigger to update clubs.updated_at when new members join (#596)

CREATE OR REPLACE FUNCTION update_club_activity_on_member_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_club_member_approval_activity
ON club_members;

CREATE TRIGGER trg_club_member_approval_activity
AFTER INSERT OR UPDATE OF status ON club_members
FOR EACH ROW
EXECUTE FUNCTION update_club_activity_on_member_approval();
