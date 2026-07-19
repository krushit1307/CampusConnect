-- ============================================================
-- Migration: Create a SECURITY DEFINER helper for user role lookups
-- Issue: #445
--
-- This function reads the application-wide role stored in
-- public.profiles without being blocked by profiles RLS. It is
-- intended for use by authenticated application code and future
-- RLS policies that need a recursion-safe role lookup.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_roles(user_id UUID)
RETURNS TEXT[]
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    ARRAY_AGG(profile.role::TEXT ORDER BY profile.role::TEXT),
    ARRAY[]::TEXT[]
  )
  FROM public.profiles AS profile
  WHERE profile.id = $1;
$$;

-- SECURITY DEFINER functions should not remain executable by PUBLIC.
REVOKE ALL ON FUNCTION public.get_user_roles(UUID) FROM PUBLIC;

-- Authenticated clients and trusted server-side code may call the RPC.
GRANT EXECUTE ON FUNCTION public.get_user_roles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles(UUID) TO service_role;

COMMENT ON FUNCTION public.get_user_roles(UUID) IS
  'Returns the application-wide profile roles for a user as text[], bypassing profiles RLS safely.';
