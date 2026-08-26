-- ============================================================
-- Migration: 20260716000007_helper_rls_functions.sql
-- Issue: #290
-- Description:
--   Creates a helper function `is_club_admin` with SECURITY DEFINER
--   to check if a user is an approved admin of a specific club.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper function: is_club_admin()
--    Returns TRUE when the given user is an approved admin
--    of the specified club.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_club_admin(club_id UUID, user_id UUID)
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
    WHERE club_members.club_id = is_club_admin.club_id
      AND club_members.user_id = is_club_admin.user_id
      AND club_members.role = 'admin'::member_role
      AND club_members.status = 'approved'::join_status
  );
END;
$$;

-- Grant execute privilege to authenticated users
GRANT EXECUTE ON FUNCTION public.is_club_admin(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------
-- 2. Update RLS policies to use the helper function
-- ------------------------------------------------------------

-- A. CLUBS policies update
DROP POLICY IF EXISTS "Club admins can update clubs." ON public.clubs;
CREATE POLICY "Club admins can update clubs." ON public.clubs
FOR UPDATE
USING (
  auth.uid() = created_by OR
  public.is_club_admin(id, auth.uid())
);

-- B. EVENTS policies update
DROP POLICY IF EXISTS "Club admins can insert events." ON public.events;
CREATE POLICY "Club admins can insert events." ON public.events
FOR INSERT
WITH CHECK (
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Club admins can update events." ON public.events;
CREATE POLICY "Club admins can update events." ON public.events
FOR UPDATE
USING (
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
);

-- C. EVENT_RSVPS policies update
DROP POLICY IF EXISTS "Club admins can read all RSVPs." ON public.event_rsvps;
CREATE POLICY "Club admins can read all RSVPs." ON public.event_rsvps
FOR SELECT
USING (
  public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_rsvps.event_id), auth.uid()) OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = (SELECT club_id FROM public.events WHERE id = event_rsvps.event_id) AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Club admins can update RSVPs (check in)." ON public.event_rsvps;
CREATE POLICY "Club admins can update RSVPs (check in)." ON public.event_rsvps
FOR UPDATE
USING (
  public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_rsvps.event_id), auth.uid()) OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = (SELECT club_id FROM public.events WHERE id = event_rsvps.event_id) AND created_by = auth.uid())
);
