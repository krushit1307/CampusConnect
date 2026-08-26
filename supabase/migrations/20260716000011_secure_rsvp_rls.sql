-- Remove existing update policy
DROP POLICY IF EXISTS "Club admins can update RSVPs (check in)."
ON event_rsvps;


-- Users can update their own RSVP
-- (trigger below prevents checked_in changes)
DROP POLICY IF EXISTS "Users can update their own RSVPs." ON event_rsvps;
CREATE POLICY "Users can update their own RSVPs."
ON event_rsvps
FOR UPDATE
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
);


-- Club admins and club creators can update RSVP check-in
DROP POLICY IF EXISTS "Club admins can update RSVP check in." ON event_rsvps;
CREATE POLICY "Club admins can update RSVP check in."
ON event_rsvps
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM club_members
    WHERE club_id = (
      SELECT club_id
      FROM events
      WHERE id = event_rsvps.event_id
    )
    AND user_id = auth.uid()
    AND role = 'admin'
    AND status = 'approved'
  )
  OR
  EXISTS (
    SELECT 1
    FROM clubs
    WHERE id = (
      SELECT club_id
      FROM events
      WHERE id = event_rsvps.event_id
    )
    AND created_by = auth.uid()
  )
);


-- Prevent normal users from changing checked_in
CREATE OR REPLACE FUNCTION prevent_rsvp_checkin_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.checked_in IS DISTINCT FROM NEW.checked_in THEN

    IF NOT EXISTS (
      SELECT 1
      FROM club_members
      WHERE club_id = (
        SELECT club_id
        FROM events
        WHERE id = OLD.event_id
      )
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM clubs
      WHERE id = (
        SELECT club_id
        FROM events
        WHERE id = OLD.event_id
      )
      AND created_by = auth.uid()
    )
    THEN
      RAISE EXCEPTION 'Only event organizers can update checked_in';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS prevent_rsvp_checkin_change_trigger
ON event_rsvps;


CREATE TRIGGER prevent_rsvp_checkin_change_trigger
BEFORE UPDATE ON event_rsvps
FOR EACH ROW
EXECUTE FUNCTION prevent_rsvp_checkin_change();