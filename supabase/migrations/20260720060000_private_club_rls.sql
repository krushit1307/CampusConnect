-- ============================================================
-- Migration: 20260720060000_private_club_rls.sql
-- Issue: #605
-- Description:
--   Adds visibility column to clubs ('public' / 'private'),
--   creates is_club_member() helper function, and updates
--   SELECT RLS policies on clubs and events so that private
--   clubs are invisible to non-members.
-- ============================================================

-- 1. Add visibility column to clubs
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
CHECK (visibility IN ('public', 'private'));

-- 2. Helper function: is_club_member()
--    Returns TRUE when the given user is an approved member
--    of the specified club.
CREATE OR REPLACE FUNCTION public.is_club_member(club_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.club_members
    WHERE club_members.club_id = is_club_member.club_id
      AND club_members.user_id = is_club_member.user_id
      AND club_members.status = 'approved'::join_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_club_member(UUID, UUID) TO authenticated;

-- 3. Update clubs SELECT policy
DROP POLICY IF EXISTS "Clubs are viewable by everyone." ON public.clubs;
CREATE POLICY "Clubs are viewable by everyone." ON public.clubs
FOR SELECT
USING (
  visibility = 'public'
  OR public.is_club_member(id, auth.uid())
  OR auth.uid() = created_by
);

-- 4. Update events SELECT policy
DROP POLICY IF EXISTS "Events are viewable by everyone." ON public.events;
CREATE POLICY "Events are viewable by everyone." ON public.events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clubs
    WHERE clubs.id = events.club_id
      AND (
        clubs.visibility = 'public'
        OR public.is_club_member(clubs.id, auth.uid())
        OR auth.uid() = clubs.created_by
      )
  )
);
