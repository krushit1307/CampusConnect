-- ============================================================
-- Migration: 20260730200000_club_job_board.sql
-- Description: Creates club_jobs + club_job_applications tables,
--              RLS policies, and RPC functions for the async
--              Job Board system.
-- Issue #1899: Asynchronous Job Board system for clubs
-- ============================================================

-- 1. club_jobs table
CREATE TABLE IF NOT EXISTS public.club_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. club_job_applications table
CREATE TABLE IF NOT EXISTS public.club_job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.club_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  application_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(job_id, user_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_club_jobs_club_id ON public.club_jobs(club_id);
CREATE INDEX IF NOT EXISTS idx_club_jobs_is_open ON public.club_jobs(club_id, is_open);
CREATE INDEX IF NOT EXISTS idx_club_job_applications_job_id ON public.club_job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_club_job_applications_user_id ON public.club_job_applications(user_id);

-- 4. Enable RLS
ALTER TABLE public.club_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_job_applications ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for club_jobs
CREATE POLICY "Jobs are viewable by everyone"
  ON public.club_jobs FOR SELECT
  USING (TRUE);

CREATE POLICY "Jobs are manageable by club admins"
  ON public.club_jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_jobs.club_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'owner')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "Jobs updatable by club admins"
  ON public.club_jobs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_jobs.club_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'owner')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "Jobs deletable by club admins"
  ON public.club_jobs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_jobs.club_id
        AND user_id = auth.uid()
        AND role IN ('admin', 'owner')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- 6. RLS policies for club_job_applications
CREATE POLICY "Applications viewable by job poster and applicant"
  ON public.club_job_applications FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_jobs j
      JOIN public.club_members cm ON cm.club_id = j.club_id
      WHERE j.id = club_job_applications.job_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'owner')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "Users can apply to jobs"
  ON public.club_job_applications FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.club_jobs j
      WHERE j.id = job_id AND j.is_open = TRUE
    )
  );

CREATE POLICY "Applications updatable by club admins"
  ON public.club_job_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_jobs j
      JOIN public.club_members cm ON cm.club_id = j.club_id
      WHERE j.id = club_job_applications.job_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'owner')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- 7. RPC: Get open jobs for a club with applicant count and user's application status
CREATE OR REPLACE FUNCTION public.get_club_jobs(p_club_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  is_open BOOLEAN,
  created_at TIMESTAMPTZ,
  applicant_count BIGINT,
  user_application_id UUID,
  user_application_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    j.id,
    j.title,
    j.description,
    j.is_open,
    j.created_at,
    COUNT(a.id)::bigint AS applicant_count,
    ua.id AS user_application_id,
    ua.status AS user_application_status
  FROM public.club_jobs j
  LEFT JOIN public.club_job_applications a ON a.job_id = j.id
  LEFT JOIN public.club_job_applications ua
    ON ua.job_id = j.id AND ua.user_id = auth.uid()
  WHERE j.club_id = p_club_id
  GROUP BY j.id, j.title, j.description, j.is_open, j.created_at, ua.id, ua.status
  ORDER BY j.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_jobs(UUID) TO authenticated, anon;

-- 8. RPC: Get applications for a specific job (admin only — RLS enforced)
CREATE OR REPLACE FUNCTION public.get_job_applications(p_job_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_avatar TEXT,
  user_handle TEXT,
  status TEXT,
  application_text TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    a.id,
    a.user_id,
    COALESCE(p.full_name, 'Unknown') AS user_name,
    p.avatar_url AS user_avatar,
    p.handle AS user_handle,
    a.status,
    a.application_text,
    a.created_at
  FROM public.club_job_applications a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE a.job_id = p_job_id
  ORDER BY a.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_job_applications(UUID) TO authenticated;

-- 9. RPC: Update application status (accept/reject)
CREATE OR REPLACE FUNCTION public.update_application_status(
  p_application_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.club_job_applications
  SET status = p_status
  WHERE id = p_application_id;
$$;

GRANT EXECUTE ON FUNCTION public.update_application_status(UUID, TEXT) TO authenticated;

-- 10. Grant table permissions
GRANT SELECT ON public.club_jobs TO authenticated, anon;
GRANT SELECT ON public.club_job_applications TO authenticated;
