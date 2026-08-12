-- ============================================================
-- Migration: 20260725000007_content_reports_table.sql
-- Issue: #1163
-- Description: Create content_reports table and admin_read RLS policy
-- ============================================================

-- 1. Ensure profiles table has is_admin column if missing
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Sync is_admin for profiles where role is admin or system_admin
UPDATE public.profiles
SET is_admin = TRUE
WHERE (role IN ('admin', 'system_admin', 'club_admin') OR role LIKE '%admin%') AND (is_admin IS FALSE OR is_admin IS NULL);

-- 2. Create content_reports table
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reporter_id, target_type, target_id)
);

-- Index for efficient querying by reporter_id and target
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON public.content_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_target ON public.content_reports(target_type, target_id);

-- 3. Enable RLS
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- 4. INSERT policy for authenticated users
DROP POLICY IF EXISTS "Users can insert content_reports" ON public.content_reports;
CREATE POLICY "Users can insert content_reports"
ON public.content_reports
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id);

-- 5. SELECT policy (admin_read) strictly for admins
DROP POLICY IF EXISTS admin_read ON public.content_reports;
CREATE POLICY admin_read
ON public.content_reports
FOR SELECT TO authenticated
USING (
  (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
  OR public.is_system_admin()
);
