-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 6 tests)
SELECT plan(6);

-- 1. Setup mock data
-- Create test users in auth.users (this triggers public.profiles creation)
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000001', 'member1@test.com', 'authenticated', 'authenticated', '{"full_name": "Member 1"}'),
  ('90000000-0000-0000-0000-000000000002', 'member2@test.com', 'authenticated', 'authenticated', '{"full_name": "Member 2"}'),
  ('90000000-0000-0000-0000-000000000003', 'creator@test.com', 'authenticated', 'authenticated', '{"full_name": "Creator"}')
ON CONFLICT (id) DO NOTHING;

-- Insert a test club (initial count should be 0)
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000004', 'Test Club Trigger', 'test-club-trigger', 'A club for testing triggers', '90000000-0000-0000-0000-000000000003');

-- Insert dynamic roles for the test club
INSERT INTO public.club_roles (id, club_id, title, permissions_level)
VALUES
  ('90000000-0000-0000-0000-000000000100', '90000000-0000-0000-0000-000000000004', 'Admin', 100),
  ('90000000-0000-0000-0000-000000000101', '90000000-0000-0000-0000-000000000004', 'Member', 10);

-- Test 1: Initial member_count is 0
SELECT is(
  (SELECT member_count FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000004'),
  0,
  'Initial member_count of new club is 0'
);

-- Test 2: Inserting a pending member does NOT increment member_count
INSERT INTO public.club_members (id, club_id, user_id, role_id, status)
VALUES ('90000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000101', 'pending');

SELECT is(
  (SELECT member_count FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000004'),
  0,
  'Pending member does not increment member_count'
);

-- Test 3: Updating a pending member to approved increments member_count
UPDATE public.club_members
SET status = 'approved'
WHERE id = '90000000-0000-0000-0000-000000000005';

SELECT is(
  (SELECT member_count FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000004'),
  1,
  'Approved member increments member_count to 1'
);

-- Test 4: Inserting an approved member directly increments member_count
INSERT INTO public.club_members (id, club_id, user_id, role_id, status)
VALUES ('90000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000101', 'approved');

SELECT is(
  (SELECT member_count FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000004'),
  2,
  'Directly inserting approved member increments member_count to 2'
);

-- Test 5: Changing approved member back to pending decrements member_count
UPDATE public.club_members
SET status = 'pending'
WHERE id = '90000000-0000-0000-0000-000000000005';

SELECT is(
  (SELECT member_count FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000004'),
  1,
  'Changing approved to pending decrements member_count to 1'
);

-- Test 6: Deleting an approved member decrements member_count
DELETE FROM public.club_members
WHERE id = '90000000-0000-0000-0000-000000000006';

SELECT is(
  (SELECT member_count FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000004'),
  0,
  'Deleting approved member decrements member_count to 0'
);

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
