-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 10 tests)
SELECT plan(10);

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

-- Test 7: The member-count trigger function exists
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_club_member_change'
  ),
  'handle_club_member_change function should exist'
);

-- Test 8: The member-count trigger is bound to club_members
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_club_member_count'
      AND c.relname = 'club_members'
  ),
  'update_club_member_count trigger should exist on club_members'
);

-- Test 9: Moving an approved member to another club decrements the old
-- club and increments the new one.
-- (member_count of club 004 is currently 0; 005 is pending.)
-- user 002 is used here because user 001 already holds a pending
-- membership in club 004 (member 005) and club_members enforces
-- UNIQUE(club_id, user_id).
INSERT INTO public.club_members (id, club_id, user_id, role_id, status)
VALUES ('90000000-0000-0000-0000-000000000008', '90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000101', 'approved');

-- Create a second club to move the member into.
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000009', 'Test Club B', 'test-club-b', 'Second club for transfer test', '90000000-0000-0000-0000-000000000003');

-- Move member 008 from club 004 to club 009.
UPDATE public.club_members
SET club_id = '90000000-0000-0000-0000-000000000009'
WHERE id = '90000000-0000-0000-0000-000000000008';

SELECT is(
  (SELECT member_count FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000004'),
  0,
  'Transferring approved member decrements old club member_count to 0'
);

SELECT is(
  (SELECT member_count FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000009'),
  1,
  'Transferring approved member increments new club member_count to 1'
);

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
