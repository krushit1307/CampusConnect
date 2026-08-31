-- =============================================================================
-- Migration: 20270920000000_classroom_dependency_auditor.sql
-- Description: Issue #5062 - GitHub Classroom Dependency Manifest Auditor (DevSecOps)
-- =============================================================================

BEGIN;

-- 1. Create github_classroom_assignments table
CREATE TABLE IF NOT EXISTS public.github_classroom_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL, -- References the series_id on events
    title TEXT NOT NULL,
    github_org TEXT NOT NULL,
    github_repo_prefix TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create github_classroom_submissions table
CREATE TABLE IF NOT EXISTS public.github_classroom_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.github_classroom_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    github_repo_name TEXT NOT NULL,
    pr_number INTEGER,
    commit_sha TEXT,
    audit_status TEXT NOT NULL CHECK (audit_status IN ('PENDING', 'PASSED', 'FAILED')) DEFAULT 'PENDING',
    vulnerabilities_found JSONB DEFAULT '[]'::jsonb,
    autograding_score INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create dependency_audit_logs table for supply-chain vulnerability logs
CREATE TABLE IF NOT EXISTS public.dependency_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.github_classroom_submissions(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    current_version TEXT NOT NULL,
    cve_id TEXT,
    cvss_score NUMERIC,
    patched_version TEXT,
    summary TEXT,
    audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.github_classroom_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_classroom_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependency_audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Allow public select of classroom assignments"
ON public.github_classroom_assignments FOR SELECT USING (true);

CREATE POLICY "Allow public select of classroom submissions"
ON public.github_classroom_submissions FOR SELECT USING (true);

CREATE POLICY "Allow public select of dependency audit logs"
ON public.dependency_audit_logs FOR SELECT USING (true);

CREATE POLICY "Allow authenticated manage of classroom assignments"
ON public.github_classroom_assignments FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated manage of classroom submissions"
ON public.github_classroom_submissions FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated manage of dependency audit logs"
ON public.dependency_audit_logs FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- 6. Trigger to sync updated_at on submissions
CREATE OR REPLACE FUNCTION public.fn_sync_submissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_submissions_updated_at
BEFORE UPDATE ON public.github_classroom_submissions
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_submissions_updated_at();

COMMIT;
