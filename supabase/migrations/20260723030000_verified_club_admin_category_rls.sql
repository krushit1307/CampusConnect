-- ============================================================
-- Migration: 20260723030000_verified_club_admin_category_rls.sql
-- Issue: #602
-- Description:
--   Restrict event_categories insertion to system admins OR
--   admins of verified clubs (is_verified = TRUE).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper function: is_verified_club_admin()
--    Returns TRUE when the calling user is an approved admin
--    of at least one club where is_verified = TRUE.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_verified_club_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM club_members cm
    JOIN club_roles cr ON cm.role_id = cr.id
    JOIN clubs c ON cm.club_id = c.id
    WHERE cm.user_id = auth.uid()
      AND c.is_verified = TRUE
      AND cr.permissions_level >= 100
      AND cm.status = 'approved'
  )
  OR EXISTS (
    SELECT 1
    FROM clubs
    WHERE created_by = auth.uid()
      AND is_verified = TRUE
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_verified_club_admin() TO authenticated;

-- ------------------------------------------------------------
-- 2. Update INSERT policy on event_categories
--    Allow system admins OR verified club admins
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "System admins can insert event categories." ON public.event_categories;

CREATE POLICY "System admins and verified club admins can insert event categories."
ON public.event_categories
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_system_admin() OR public.is_verified_club_admin()
);

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------
