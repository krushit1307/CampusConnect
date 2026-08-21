-- Migration: Implement soft deletes globally for profiles (users) and events,
-- and close gaps in the existing clubs soft-delete implementation.
-- Related issue: #2266

-- ============================================================
-- STEP 1: Add deleted_at columns
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_events_deleted_at ON events(deleted_at);

-- ============================================================
-- STEP 2: Global Scope (Postgres-native) — every SELECT is
-- filtered at the database layer via RLS, so no client can
-- ever forget the "WHERE deleted_at IS NULL" check. System
-- admins get a bypass so the restore UI can still see them.
-- ============================================================
DROP POLICY IF EXISTS "Allow SELECT for all authenticated users" ON public.profiles;
CREATE POLICY "Allow SELECT for all authenticated users" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL OR public.is_system_admin());

DROP POLICY IF EXISTS "Events are viewable by everyone." ON public.events;
DROP POLICY IF EXISTS "Events are viewable by public or club members." ON public.events;
CREATE POLICY "Events are viewable by public or club members." ON public.events
  FOR SELECT USING (
    (deleted_at IS NULL OR public.is_system_admin()) AND (
      is_private IS FALSE OR is_private IS NULL OR
      auth.uid() = created_by OR
      EXISTS (
        SELECT 1 FROM club_members
        WHERE club_members.club_id = events.club_id
          AND club_members.user_id = auth.uid()
          AND club_members.status = 'approved'
      ) OR
      EXISTS (SELECT 1 FROM clubs WHERE id = events.club_id AND created_by = auth.uid()) OR
      EXISTS (SELECT 1 FROM event_cohosts WHERE event_id = events.id AND user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Clubs are viewable by everyone." ON public.clubs;
CREATE POLICY "Clubs are viewable by everyone." ON public.clubs
  FOR SELECT USING (deleted_at IS NULL OR public.is_system_admin());

-- ============================================================
-- STEP 3: Replace hard-DELETE routes with soft-delete UPDATEs
-- ============================================================
DROP POLICY IF EXISTS "Super admins can delete clubs." ON public.clubs;
CREATE POLICY "Super admins can soft-delete clubs." ON public.clubs
  FOR UPDATE
  USING (public.has_permission(auth.uid(), 'clubs.delete'))
  WITH CHECK (public.has_permission(auth.uid(), 'clubs.delete'));

DROP POLICY IF EXISTS "Club admins can delete events." ON public.events;
CREATE POLICY "Club admins can soft-delete events." ON public.events
  FOR UPDATE
  USING (
    public.has_permission(auth.uid(), 'events.delete') OR
    public.is_club_admin(club_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
  )
  WITH CHECK (
    public.has_permission(auth.uid(), 'events.delete') OR
    public.is_club_admin(club_id, auth.uid()) OR
    EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "System admins can soft-delete profiles" ON public.profiles;
CREATE POLICY "System admins can soft-delete profiles" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- ============================================================
-- STEP 4: Edge case — partial unique index so a deleted club's
-- slug can be reused instead of throwing a unique-constraint
-- violation forever (mirrors the "email reuse" case in the issue).
-- ============================================================
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS clubs_slug_unique_active ON clubs(slug) WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 5: The existing hard-DELETE cascade trigger on profiles
-- only ran when a row was physically deleted. Now that deletes
-- are soft, fire it on the UPDATE that sets deleted_at instead.
-- ============================================================
DROP TRIGGER IF EXISTS trigger_profile_soft_delete_cascade ON profiles;

CREATE OR REPLACE FUNCTION public.handle_profile_soft_delete_cascade()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts SET deleted_at = NOW() WHERE author_id = NEW.id;
  UPDATE public.comments SET deleted_at = NOW() WHERE author_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_profile_soft_delete_cascade
AFTER UPDATE OF deleted_at ON profiles
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION public.handle_profile_soft_delete_cascade();