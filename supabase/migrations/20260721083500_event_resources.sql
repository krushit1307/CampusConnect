CREATE TYPE resource_type AS ENUM (
  'link',
  'pdf',
  'image'
);
CREATE TABLE event_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  resource_type resource_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_event_resources_event_id
ON event_resources(event_id);

ALTER TABLE event_resources
ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event resources can be viewed everyone."
ON event_resources
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM events
    JOIN clubs ON clubs.id = events.club_id
    WHERE events.id = event_resources.event_id
      AND (
        clubs.visibility = 'public'
        OR public.is_club_member(clubs.id, auth.uid())
        OR auth.uid() = clubs.created_by
      )
  )
);
CREATE POLICY "Club admins can add event resources."
ON event_resources
FOR INSERT
WITH CHECK (
  public.is_club_admin(
    (SELECT club_id
     FROM events
     WHERE id = event_resources.event_id),
    auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM clubs
    WHERE id = (
      SELECT club_id
      FROM events
      WHERE id = event_resources.event_id
    )
      AND created_by = auth.uid()
  )
);
CREATE POLICY "Club admins can update event resources."
ON event_resources
FOR UPDATE
USING (
  public.is_club_admin(
    (SELECT club_id
     FROM events
     WHERE id = event_resources.event_id),
    auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM clubs
    WHERE id = (
      SELECT club_id
      FROM events
      WHERE id = event_resources.event_id
    )
      AND created_by = auth.uid()
  )
);
CREATE POLICY "Club admins can delete event resources."
ON event_resources
FOR DELETE
USING (
  public.is_club_admin(
    (SELECT club_id
     FROM events
     WHERE id = event_resources.event_id),
    auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM clubs
    WHERE id = (
      SELECT club_id
      FROM events
      WHERE id = event_resources.event_id
    )
      AND created_by = auth.uid()
  )
);