-- Re-affirm RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might conflict with the new rules
DROP POLICY IF EXISTS "Users can insert reports." ON reports;
DROP POLICY IF EXISTS "Users can view own reports." ON reports;
DROP POLICY IF EXISTS "System admins can view all reports." ON reports;
DROP POLICY IF EXISTS "System admins can update reports." ON reports;
DROP POLICY IF EXISTS "System admins can delete reports." ON reports;

-- 1. INSERT policy: any authenticated user can create a report
CREATE POLICY "Users can insert reports." ON reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- 2. SELECT policy: strictly for system admins
CREATE POLICY "System admins can view all reports." ON reports
  FOR SELECT TO authenticated
  USING (public.is_system_admin());

-- 3. UPDATE policy: strictly for system admins
CREATE POLICY "System admins can update reports." ON reports
  FOR UPDATE TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

-- 4. DELETE policy: strictly for system admins
CREATE POLICY "System admins can delete reports." ON reports
  FOR DELETE TO authenticated
  USING (public.is_system_admin());
