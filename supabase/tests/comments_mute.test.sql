-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(3);

-- Grant privileges to authenticated role so that table-level permissions do not interfere with RLS testing
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock data
-- Create test users in auth.users (this triggers public.profiles creation)
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000101', 'usera_mute@test.com', 'authenticated', 'authenticated', '{"full_name": "Muted User"}'),
  ('90000000-0000-0000-0000-000000000102', 'userb_mute@test.com', 'authenticated', 'authenticated', '{"full_name": "Normal User"}'),
  ('90000000-0000-0000-0000-000000000103', 'admin_mute@test.com', 'authenticated', 'authenticated', '{"full_name": "Admin User"}')
ON CONFLICT (id) DO NOTHING;

-- Set correct roles in profiles table
UPDATE public.profiles SET role = 'student' WHERE id IN ('90000000-0000-0000-0000-000000000101', '90000000-0000-0000-0000-000000000102');
UPDATE public.profiles SET role = 'club_admin' WHERE id = '90000000-0000-0000-0000-000000000103';

-- Create a club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000104', 'Test Mute Club', 'test-mute-club', 'A club for testing mute', '90000000-0000-0000-0000-000000000103');

-- Approve memberships for Muted User, Normal User, and Admin User (so they can post/comment)
INSERT INTO public.club_members (id, club_id, user_id, role, status)
VALUES 
  ('90000000-0000-0000-0000-000000000108', '90000000-0000-0000-0000-000000000104', '90000000-0000-0000-0000-000000000101', 'member', 'approved'),
  ('90000000-0000-0000-0000-000000000109', '90000000-0000-0000-0000-000000000104', '90000000-0000-0000-0000-000000000102', 'member', 'approved'),
  ('90000000-0000-0000-0000-000000000110', '90000000-0000-0000-0000-000000000104', '90000000-0000-0000-0000-000000000103', 'admin', 'approved')
ON CONFLICT (id) DO NOTHING;

-- Mute user 101 in club 104
INSERT INTO public.club_muted_users (club_id, user_id)
VALUES ('90000000-0000-0000-0000-000000000104', '90000000-0000-0000-0000-000000000101');

-- Create a post
INSERT INTO public.posts (id, club_id, author_id, content)
VALUES ('90000000-0000-0000-0000-000000000111', '90000000-0000-0000-0000-000000000104', '90000000-0000-0000-0000-000000000103', 'Post content');

-- ==========================================
-- Test Case 1: Unmuted regular user (Normal User) can insert comment
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000102', true);

SELECT lives_ok(
  $$INSERT INTO public.comments (id, post_id, author_id, content) VALUES ('90000000-0000-0000-0000-000000000112', '90000000-0000-0000-0000-000000000111', '90000000-0000-0000-0000-000000000102', 'Normal user comment')$$,
  'Unmuted member can insert comment'
);

RESET role;

-- ==========================================
-- Test Case 2: Muted regular user (Muted User) cannot insert comment
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000101', true);

SELECT throws_ok(
  $$INSERT INTO public.comments (id, post_id, author_id, content) VALUES ('90000000-0000-0000-0000-000000000113', '90000000-0000-0000-0000-000000000111', '90000000-0000-0000-0000-000000000101', 'Muted user comment')$$,
  '42501',
  NULL,
  'Muted member cannot insert comment'
);

RESET role;

-- ==========================================
-- Test Case 3: Club Admin can insert comment
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000103', true);

SELECT lives_ok(
  $$INSERT INTO public.comments (id, post_id, author_id, content) VALUES ('90000000-0000-0000-0000-000000000114', '90000000-0000-0000-0000-000000000111', '90000000-0000-0000-0000-000000000103', 'Admin user comment')$$,
  'Club admin can insert comment'
);

RESET role;

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
