-- Issue #1092: Implement RLS policies for Event Co-hosts
-- Introduces user-level co-hosting for events (distinct from the existing
-- club-level event_co_hosts table added for #590). A co-host can edit and
-- delete the event, same as the original creator or a club admin.

-- ---------------------------------------------------------------------------
-- 1. event_cohosts table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_cohosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_cohosts ENABLE ROW LEVEL SECURITY;

-- Event creators, club admins, and the cohost themselves can see who is
-- listed as a cohost on an event.
DROP POLICY IF EXISTS "Event creators and club admins can view cohosts." ON event_cohosts;
CREATE POLICY "Event creators and club admins can view cohosts." ON event_cohosts
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM events WHERE id = event_cohosts.event_id AND created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM events e
      JOIN club_members cm ON cm.club_id = e.club_id
      WHERE e.id = event_cohosts.event_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'approved'
    )
  );

-- Only the event's creator or a club admin can add a cohost.
DROP POLICY IF EXISTS "Event creators and club admins can add cohosts." ON event_cohosts;
CREATE POLICY "Event creators and club admins can add cohosts." ON event_cohosts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE id = event_cohosts.event_id AND created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM events e
      JOIN club_members cm ON cm.club_id = e.club_id
      WHERE e.id = event_cohosts.event_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'approved'
    )
  );

-- Only the event's creator or a club admin can remove a cohost.
DROP POLICY IF EXISTS "Event creators and club admins can remove cohosts." ON event_cohosts;
CREATE POLICY "Event creators and club admins can remove cohosts." ON event_cohosts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM events WHERE id = event_cohosts.event_id AND created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM events e
      JOIN club_members cm ON cm.club_id = e.club_id
      WHERE e.id = event_cohosts.event_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
        AND cm.status = 'approved'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Update the events UPDATE policy to also allow cohosts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Club admins can update events." ON events;
CREATE POLICY "Club admins can update events." ON events FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = events.club_id AND user_id = auth.uid() AND role = 'admin' AND status = 'approved'
  )
  OR EXISTS (SELECT 1 FROM clubs WHERE id = events.club_id AND created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM event_cohosts WHERE event_id = events.id AND user_id = auth.uid())
);

-- ---------------------------------------------------------------------------
-- 3. Create the events DELETE policy (none existed previously — RLS's
--    default-deny meant nobody, not even the creator or a club admin, could
--    delete an event). Mirrors the UPDATE policy above, plus cohost access.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Club admins can delete events." ON events;
CREATE POLICY "Club admins can delete events." ON events FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM club_members
    WHERE club_id = events.club_id AND user_id = auth.uid() AND role = 'admin' AND status = 'approved'
  )
  OR EXISTS (SELECT 1 FROM clubs WHERE id = events.club_id AND created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM event_cohosts WHERE event_id = events.id AND user_id = auth.uid())
);
