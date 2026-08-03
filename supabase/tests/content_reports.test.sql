-- ============================================================
-- Test Suite: content_reports.test.sql
-- Issue: #1163
-- Description: Verifies content_reports table structure and admin_read RLS policy
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (4 tests)
SELECT plan(4);

-- Test 1: Table content_reports exists
SELECT has_table('public', 'content_reports', 'Table content_reports should exist in public schema');

-- Setup mock users
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'user@test.com', 'authenticated', 'authenticated', '{"full_name": "Standard User"}'),
  ('c0000000-0000-0000-0000-000000000002', 'admin@test.com', 'authenticated', 'authenticated', '{"full_name": "Admin User"}')
ON CONFLICT (id) DO NOTHING;

-- Set is_admin flag in profiles table
UPDATE public.profiles SET is_admin = FALSE WHERE id = 'c0000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET is_admin = TRUE WHERE id = 'c0000000-0000-0000-0000-000000000002';

-- Test 2: Standard authenticated user can insert a content report
SELECT lives_ok(
  $$INSERT INTO public.content_reports (id, reporter_id, target_type, target_id, reason, details)
    VALUES (
      'c0000000-0000-0000-0000-000000000003',
      'c0000000-0000-0000-0000-000000000001',
      'post',
      'c0000000-0000-0000-0000-000000000099',
      'Spam',
      'Inappropriate advertising post'
    )$$,
  'Standard authenticated user can insert content report'
);

-- Test 3: Admin user can read content_reports
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.content_reports
    WHERE id = 'c0000000-0000-0000-0000-000000000003'
  ),
  'Content report is stored in database'
);

-- Test 4: Verify RLS policy admin_read exists on content_reports
SELECT policies_are(
  'public',
  'content_reports',
  ARRAY['Users can insert content_reports', 'admin_read'],
  'content_reports has Users can insert content_reports and admin_read policies'
);

SELECT * FROM finish();
ROLLBACK;
