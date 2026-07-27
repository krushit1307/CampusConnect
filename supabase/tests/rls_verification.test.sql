-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 15 tests)
SELECT plan(15);

-- Grant privileges to authenticated role so that table-level permissions do not interfere with RLS testing
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- 1. Setup mock data
-- Create test users in auth.users (this triggers public.profiles creation)
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000001', 'usera@test.com', 'authenticated', 'authenticated', '{"full_name": "User A"}'),
  ('90000000-0000-0000-0000-000000000002', 'userb@test.com', 'authenticated', 'authenticated', '{"full_name": "User B"}'),
  ('90000000-0000-0000-0000-000000000003', 'admin@test.com', 'authenticated', 'authenticated', '{"full_name": "Admin User"}'),
  ('90000000-0000-0000-0000-000000000010', 'sysadmin@test.com', 'authenticated', 'authenticated', '{"full_name": "System Admin User"}'),
  ('90000000-0000-0000-0000-000000000011', 'userc@test.com', 'authenticated', 'authenticated', '{"full_name": "User C"}')
ON CONFLICT (id) DO NOTHING;

-- Set correct roles in profiles table
UPDATE public.profiles SET role = 'student' WHERE id IN ('90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000011');
UPDATE public.profiles SET role = 'club_admin' WHERE id = '90000000-0000-0000-0000-000000000003';
UPDATE public.profiles SET role = 'system_admin' WHERE id = '90000000-0000-0000-0000-000000000010';

-- Create a primary club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000004', 'Test Club RLS', 'test-club-rls', 'A club for testing RLS', '90000000-0000-0000-0000-000000000003');

-- Insert dynamic roles for the primary club
INSERT INTO public.club_roles (id, club_id, title, permissions_level)
VALUES
  ('90000000-0000-0000-0000-000000000100', '90000000-0000-0000-0000-000000000004', 'Admin', 100),
  ('90000000-0000-0000-0000-000000000101', '90000000-0000-0000-0000-000000000004', 'Member', 10);

-- Create an event for the club
INSERT INTO public.events (id, club_id, title, description, location, created_by)
VALUES ('90000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000004', 'Test Event RLS', 'Event description', 'Online', '90000000-0000-0000-0000-000000000003');

-- Create RSVPs for User A and User B (User C has no RSVP)
INSERT INTO public.event_rsvps (id, event_id, user_id, checked_in)
VALUES
  ('90000000-0000-0000-0000-000000000006', '90000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000001', false),
  ('90000000-0000-0000-0000-000000000007', '90000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000002', false);

-- Create event resource
INSERT INTO public.event_resources (id, event_id, title, url, resource_type)
VALUES ('90000000-0000-0000-0000-000000000030', '90000000-0000-0000-0000-000000000005', 'Test Slides', 'https://example.com/slides.pdf', 'pdf');

-- ==========================================
-- Test RLS: Students cannot read other users' RSVPs
-- ==========================================

-- Switch context to authenticated User A
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);

-- User A should be able to see their own RSVP
SELECT ok(
  EXISTS (SELECT 1 FROM public.event_rsvps WHERE id = '90000000-0000-0000-0000-000000000006'),
  'Student can read their own RSVP'
);

-- User A should NOT be able to see User B's RSVP
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.event_rsvps WHERE id = '90000000-0000-0000-0000-000000000007'),
  'Student cannot read other users'' RSVPs'
);

-- User A (has RSVP) CAN read the event resources
SELECT ok(
  EXISTS (SELECT 1 FROM public.event_resources WHERE id = '90000000-0000-0000-0000-000000000030'),
  'Attendee with RSVP can view event resources'
);

-- Reset back to postgres superuser role
RESET role;

-- Switch context to authenticated User C (no RSVP)
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000011', true);

-- User C should NOT be able to see event resources
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.event_resources WHERE id = '90000000-0000-0000-0000-000000000030'),
  'Non-attendee without RSVP cannot view event resources'
);

-- Reset back to postgres superuser role
RESET role;

-- Switch context to Club Admin (creator of the club)
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000003', true);

-- Club Admin can see event resources
SELECT ok(
  EXISTS (SELECT 1 FROM public.event_resources WHERE id = '90000000-0000-0000-0000-000000000030'),
  'Club Admin can view event resources'
);

-- Reset back to postgres superuser role
RESET role;

-- ==========================================
-- Test RLS: Unapproved members cannot create posts
-- ==========================================

-- Case 1: User A is a non-member (no club_members entry at all)
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);

SELECT throws_ok(
  $$INSERT INTO public.posts (club_id, author_id, content) VALUES ('90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', 'This post should fail')$$,
  '42501',
  NULL,
  'Non-member cannot create posts'
);

-- Reset back to postgres superuser role
RESET role;

-- Insert a pending membership for User A
INSERT INTO public.club_members (id, club_id, user_id, role_id, status)
VALUES ('90000000-0000-0000-0000-000000000008', '90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000101', 'pending');

-- Case 2: User A is a pending member of the club
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);

SELECT throws_ok(
  $$INSERT INTO public.posts (club_id, author_id, content) VALUES ('90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', 'This post should fail')$$,
  '42501',
  NULL,
  'Pending member cannot create posts'
);

-- Reset back to postgres superuser role
RESET role;

-- Approve the membership for User A
UPDATE public.club_members SET status = 'approved' WHERE id = '90000000-0000-0000-0000-000000000008';

-- Case 3: User A is an approved member of the club
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);

SELECT lives_ok(
  $$INSERT INTO public.posts (id, club_id, author_id, content) VALUES ('90000000-0000-0000-0000-000000000009', '90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', 'This post should succeed')$$,
  'Approved member can create posts'
);

-- Reset back to postgres superuser role
RESET role;

-- ==========================================
-- Test RLS: Non-admin users cannot write to event_categories
-- ==========================================

-- Switch context to authenticated User A (non-admin student)
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);

SELECT throws_ok(
  $$INSERT INTO public.event_categories (id, name, description) VALUES ('90000000-0000-0000-0000-000000000021', 'Racer Category', 'Should fail')$$,
  '42501',
  NULL,
  'Non-admin cannot insert event categories'
);

-- Reset back to postgres superuser role
RESET role;

-- ==========================================
-- Test RLS: System admin users can write to event_categories
-- ==========================================

-- Switch context to System Admin User
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000010', true);

-- Can insert
SELECT lives_ok(
  $$INSERT INTO public.event_categories (id, name, description) VALUES ('90000000-0000-0000-0000-000000000021', 'New Admin Category', 'Created by system admin')$$,
  'System admin can insert event categories'
);

-- Can update
SELECT lives_ok(
  $$UPDATE public.event_categories SET description = 'Updated by system admin' WHERE id = '90000000-0000-0000-0000-000000000021'$$,
  'System admin can update event categories'
);

-- Reset back to postgres superuser role
RESET role;

-- ==========================================
-- Test RLS: Co-host club admin can update events (#591)
-- ==========================================

-- Create a co-hosting club admin user
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('90000000-0000-0000-0000-000000000020', 'cohost_admin@test.com', 'authenticated', 'authenticated', '{"full_name": "CoHost Admin"}')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET role = 'club_admin' WHERE id = '90000000-0000-0000-0000-000000000020';

-- Create a co-hosting club (different from the primary club)
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000022', 'Co-Host Club', 'co-host-club', 'Secondary hosting club', '90000000-0000-0000-0000-000000000020');

-- Insert dynamic roles for the co-host club
INSERT INTO public.club_roles (id, club_id, title, permissions_level)
VALUES
  ('90000000-0000-0000-0000-000000000102', '90000000-0000-0000-0000-000000000022', 'Admin', 100),
  ('90000000-0000-0000-0000-000000000103', '90000000-0000-0000-0000-000000000022', 'Member', 10);

-- Make the co-host user an approved admin of the co-host club
INSERT INTO public.club_members (id, club_id, user_id, role_id, status)
VALUES ('90000000-0000-0000-0000-000000000023', '90000000-0000-0000-0000-000000000022', '90000000-0000-0000-0000-000000000020', '90000000-0000-0000-0000-000000000102', 'approved');

-- Register the co-host club for the test event
INSERT INTO public.event_co_hosts (event_id, club_id)
VALUES ('90000000-0000-0000-0000-000000000005', '90000000-0000-0000-0000-000000000022');

-- Test 12: Co-host club admin CAN update event details
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000020', true);

UPDATE public.events
SET description = 'Updated by co-host admin'
WHERE id = '90000000-0000-0000-0000-000000000005';

RESET role;

SELECT is(
  (SELECT description FROM public.events WHERE id = '90000000-0000-0000-0000-000000000005'),
  'Updated by co-host admin',
  'Co-host club admin successfully updated event details'
);

-- Test 13: Regular student (User B, not a co-host admin) CANNOT update the event
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);

UPDATE public.events
SET description = 'Updated by student'
WHERE id = '90000000-0000-0000-0000-000000000005';

RESET role;

SELECT is(
  (SELECT description FROM public.events WHERE id = '90000000-0000-0000-0000-000000000005'),
  'Updated by co-host admin',
  'Student was blocked from updating event details'
);

-- Reset back to postgres superuser role
RESET role;

-- ==========================================
-- Test RLS: Verified club admin can insert event categories (#602)
-- ==========================================

-- Create a verified club
INSERT INTO public.clubs (id, name, slug, description, created_by, is_verified)
VALUES ('90000000-0000-0000-0000-000000000040', 'Verified Club', 'verified-club', 'A verified club', '90000000-0000-0000-0000-000000000003', true);

-- Insert dynamic roles for the verified club
INSERT INTO public.club_roles (id, club_id, title, permissions_level)
VALUES
  ('90000000-0000-0000-0000-000000000104', '90000000-0000-0000-0000-000000000040', 'Admin', 100),
  ('90000000-0000-0000-0000-000000000105', '90000000-0000-0000-0000-000000000040', 'Member', 10);

-- Make User C an admin of the verified club
INSERT INTO public.club_members (id, club_id, user_id, role_id, status)
VALUES ('90000000-0000-0000-0000-000000000041', '90000000-0000-0000-0000-000000000040', '90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000104', 'approved');

-- Switch context to User C (now a verified club admin)
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000011', true);

SELECT lives_ok(
  $$INSERT INTO public.event_categories (id, name, description) VALUES ('90000000-0000-0000-0000-000000000050', 'Verified Club Category', 'Created by verified club admin')$$,
  'Verified club admin can insert event categories'
);

-- Reset back to postgres superuser role
RESET role;

-- ==========================================
-- Test RLS: Non-verified club admin cannot insert event categories (#602)
-- ==========================================

-- Create a non-verified club with User B as admin
INSERT INTO public.clubs (id, name, slug, description, created_by, is_verified)
VALUES ('90000000-0000-0000-0000-000000000060', 'Non-Verified Club', 'non-verified-club', 'A non-verified club', '90000000-0000-0000-0000-000000000002', false);

-- Insert dynamic roles for the non-verified club
INSERT INTO public.club_roles (id, club_id, title, permissions_level)
VALUES
  ('90000000-0000-0000-0000-000000000106', '90000000-0000-0000-0000-000000000060', 'Admin', 100),
  ('90000000-0000-0000-0000-000000000107', '90000000-0000-0000-0000-000000000060', 'Member', 10);

-- Make User B an admin of the non-verified club
INSERT INTO public.club_members (id, club_id, user_id, role_id, status)
VALUES ('90000000-0000-0000-0000-000000000061', '90000000-0000-0000-0000-000000000060', '90000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000106', 'approved');

-- Switch context to User B (non-verified club admin)
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);

SELECT throws_ok(
  $$INSERT INTO public.event_categories (id, name, description) VALUES ('90000000-0000-0000-0000-000000000070', 'Spam Category', 'Should fail')$$,
  '42501',
  NULL,
  'Non-verified club admin cannot insert event categories'
);

-- Reset role and finish
RESET role;
SELECT * FROM finish();
ROLLBACK;
