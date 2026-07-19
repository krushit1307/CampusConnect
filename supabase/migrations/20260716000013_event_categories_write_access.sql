-- ============================================================
-- Migration: 20260716000013_event_categories_write_access.sql
-- Issue: #300
-- Description:
--   Adds a helper function to check system administrator
--   privileges and RLS policies that allow INSERT, UPDATE,
--   and DELETE on event_categories for system admins only.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Update user_role ENUM to support system_admin role
-- ------------------------------------------------------------
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'system_admin';

-- ------------------------------------------------------------
-- 1. Helper function: is_system_admin()
--    Returns TRUE when the calling user has the 'system_admin'
--    role stored in their profile's app_metadata (JWT claim)
--    OR when the profiles.role column equals 'system_admin'.
--
--    Using SECURITY DEFINER so the function can read the
--    profiles table regardless of the caller's RLS context.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Check Supabase JWT app_metadata claim first (fast path, no DB round-trip)
  IF (auth.jwt() -> 'app_metadata' ->> 'role') = 'system_admin' THEN
    RETURN TRUE;
  END IF;

  -- Fallback: check the profiles table role column
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role::TEXT = 'system_admin'
  );
END;
$$;

-- Grant execute to authenticated users so the function can be
-- called inside RLS policies evaluated on their behalf.
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;

-- ------------------------------------------------------------
-- 2. RLS write policies for event_categories
--
--    The SELECT policy already exists from migration 002;
--    we only add the missing write policies here.
-- ------------------------------------------------------------

-- DROP existing write policies if they were partially applied
-- (idempotent re-run safety)
DROP POLICY IF EXISTS "System admins can insert event categories."  ON public.event_categories;
DROP POLICY IF EXISTS "System admins can update event categories."  ON public.event_categories;
DROP POLICY IF EXISTS "System admins can delete event categories."  ON public.event_categories;

-- INSERT: only system admins may create new categories
DROP POLICY IF EXISTS "System admins can insert event categories." ON public.event_categories;
CREATE POLICY "System admins can insert event categories."
ON public.event_categories
FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin());

-- UPDATE: only system admins may edit existing categories
DROP POLICY IF EXISTS "System admins can update event categories." ON public.event_categories;
CREATE POLICY "System admins can update event categories."
ON public.event_categories
FOR UPDATE
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- DELETE: only system admins may remove categories
DROP POLICY IF EXISTS "System admins can delete event categories." ON public.event_categories;
CREATE POLICY "System admins can delete event categories."
ON public.event_categories
FOR DELETE
TO authenticated
USING (public.is_system_admin());

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------
