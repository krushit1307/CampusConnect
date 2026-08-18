-- Migration: Secure profiles table RLS to prevent privilege escalation
-- Prevents normal users from updating 'role' field to escalate privileges

-- UP migration

-- 1. Drop the permissive update policy
DROP POLICY IF EXISTS "Users can update own profile." ON profiles;

-- 2. Create restrictive update policy for normal users
-- Users can only update safe fields, not role
CREATE POLICY "Users can update own profile (safe fields only)." ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    -- Allow updates only if role is NOT being changed
    -- or if the user is a system admin
    ((SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) IS NOT DISTINCT FROM role)
    OR public.is_system_admin()
  )
);

-- 3. Create separate policy for system admins to update any field including role
CREATE POLICY "System admins can update any profile." ON profiles
FOR UPDATE
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- DOWN migration

-- To rollback this migration, run:
-- DROP POLICY IF EXISTS "System admins can update any profile." ON profiles;
-- DROP POLICY IF EXISTS "Users can update own profile (safe fields only)." ON profiles;
-- CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);
