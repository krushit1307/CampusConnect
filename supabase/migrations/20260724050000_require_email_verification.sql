-- Issue #1080: Require email verification before RSVP and posting
-- Strictly enforces email verification at the database level so unverified
-- users cannot RSVP to events or create posts, even if a frontend check is
-- bypassed. Uses the standard Supabase JWT `email_verified` claim.

-- ---------------------------------------------------------------------------
-- posts: require email verification in addition to existing membership check
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Club members can insert posts." ON posts;
CREATE POLICY "Club members can insert posts." ON posts FOR INSERT WITH CHECK (
  (auth.jwt() ->> 'email_verified')::boolean = true
  AND (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = posts.club_id AND user_id = auth.uid() AND status = 'approved'
    )
    OR EXISTS (SELECT 1 FROM clubs WHERE id = posts.club_id AND created_by = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- event_rsvps: require email verification in addition to existing self-check
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can RSVP." ON event_rsvps;
CREATE POLICY "Users can RSVP." ON event_rsvps FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND (auth.jwt() ->> 'email_verified')::boolean = true
);
