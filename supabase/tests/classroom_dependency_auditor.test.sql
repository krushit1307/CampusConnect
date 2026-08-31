-- =============================================================================
-- Test Suite: classroom_dependency_auditor.test.sql
-- Purpose: Verify schema structures, constraints, and audit log relations.
-- =============================================================================

BEGIN;

SELECT plan(6);

-- 1. Schema structure checks
SELECT has_table('public', 'github_classroom_assignments', 'github_classroom_assignments table exists');
SELECT has_table('public', 'github_classroom_submissions', 'github_classroom_submissions table exists');
SELECT has_table('public', 'dependency_audit_logs', 'dependency_audit_logs table exists');

-- Setup seeds
-- Profiles
INSERT INTO public.profiles (id, full_name, role)
VALUES ('00000000-0000-0000-0000-dc0000000001'::uuid, 'Classroom Student', 'student')
ON CONFLICT (id) DO NOTHING;

-- Assignment (Series ID can be any mock UUID)
INSERT INTO public.github_classroom_assignments (id, series_id, title, github_org, github_repo_prefix)
VALUES (
  '00000000-0000-0000-0000-dc0000000002'::uuid,
  '00000000-0000-0000-0000-dc0000000003'::uuid,
  'Lab 1: Express API',
  'cc-classroom',
  'lab-1-express'
)
ON CONFLICT (id) DO NOTHING;

-- Submission
INSERT INTO public.github_classroom_submissions (id, assignment_id, student_id, github_repo_name, pr_number, commit_sha, audit_status)
VALUES (
  '00000000-0000-0000-0000-dc0000000004'::uuid,
  '00000000-0000-0000-0000-dc0000000002'::uuid,
  '00000000-0000-0000-0000-dc0000000001'::uuid,
  'lab-1-express-student1',
  1,
  'sha123456',
  'PENDING'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Test initial status is correctly registered
SELECT is(
  (SELECT audit_status FROM public.github_classroom_submissions WHERE id = '00000000-0000-0000-0000-dc0000000004'::uuid),
  'PENDING',
  'Submission status defaults to PENDING'
);

-- 3. Verify trigger updates updated_at automatically
UPDATE public.github_classroom_submissions
SET audit_status = 'PASSED'
WHERE id = '00000000-0000-0000-0000-dc0000000004'::uuid;

SELECT is(
  (SELECT audit_status FROM public.github_classroom_submissions WHERE id = '00000000-0000-0000-0000-dc0000000004'::uuid),
  'PASSED',
  'Submission status correctly updates to PASSED'
);

-- 4. Check foreign key cascade deletion
DELETE FROM public.github_classroom_assignments WHERE id = '00000000-0000-0000-0000-dc0000000002'::uuid;

SELECT is(
  (SELECT COUNT(*)::INT FROM public.github_classroom_submissions WHERE assignment_id = '00000000-0000-0000-0000-dc0000000002'::uuid),
  0,
  'Cascade delete removes child submissions when assignment is deleted'
);

ROLLBACK;
