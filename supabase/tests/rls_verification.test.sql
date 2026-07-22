-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 11 tests)
SELECT plan(11);

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

-- Create a club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000004', 'Test Club RLS', 'test-club-rls', 'A club for testing RLS', '90000000-0000-0000-0000-000000000003');

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
INSERT INTO public.club_members (id, club_id, user_id, role, status)
VALUES ('90000000-0000-0000-0000-000000000008', '90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', 'member', 'pending');

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

-- Can update and delete
SELECT lives_ok(
  $$UPDATE public.event_categories SET description = 'Updated by system admin' WHERE id = '90000000-0000-0000-0000-000000000021'$$,
  'System admin can update event categories'
);

-- Reset role and finish
RESET role;
SELECT * FROM finish();
ROLLBACK;

