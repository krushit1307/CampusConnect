-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 4 tests)
SELECT plan(4);

-- Grant privileges to authenticated role so that table-level permissions do not interfere with RLS testing
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock data
-- Create test users in auth.users (this triggers public.profiles creation)
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000001', 'usera@test.com', 'authenticated', 'authenticated', '{"full_name": "User A"}'),
  ('90000000-0000-0000-0000-000000000002', 'userb@test.com', 'authenticated', 'authenticated', '{"full_name": "User B"}'),
  ('90000000-0000-0000-0000-000000000003', 'admin@test.com', 'authenticated', 'authenticated', '{"full_name": "Admin User"}')
ON CONFLICT (id) DO NOTHING;

-- Set correct roles in profiles table
UPDATE public.profiles SET role = 'student' WHERE id IN ('90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002');
UPDATE public.profiles SET role = 'club_admin' WHERE id = '90000000-0000-0000-0000-000000000003';

-- Create a club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000004', 'Test Club RLS', 'test-club-rls', 'A club for testing RLS', '90000000-0000-0000-0000-000000000003');

-- Approve memberships for User A, User B, and Admin User (so they can post/comment)
INSERT INTO public.club_members (id, club_id, user_id, role, status)
VALUES 
  ('90000000-0000-0000-0000-000000000008', '90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', 'member', 'approved'),
  ('90000000-0000-0000-0000-000000000009', '90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000002', 'member', 'approved'),
  ('90000000-0000-0000-0000-000000000010', '90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000003', 'admin', 'approved')
ON CONFLICT (id) DO NOTHING;

-- Create a post
INSERT INTO public.posts (id, club_id, author_id, content)
VALUES ('90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000003', 'Admin Post');

-- Create a comment by User A
INSERT INTO public.comments (id, post_id, author_id, content)
VALUES ('90000000-0000-0000-0000-000000000012', '90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000001', 'User A Comment');

-- Create a comment by Admin User
INSERT INTO public.comments (id, post_id, author_id, content)
VALUES ('90000000-0000-0000-0000-000000000013', '90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000003', 'Admin Comment');

-- Create another comment by User B for testing admin delete restriction
INSERT INTO public.comments (id, post_id, author_id, content)
VALUES ('90000000-0000-0000-0000-000000000014', '90000000-0000-0000-0000-000000000011', '90000000-0000-0000-0000-000000000002', 'User B Comment');


-- ==========================================
-- Test Case 1: A user can delete their own comment
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000001', true);

SELECT lives_ok(
  $$DELETE FROM public.comments WHERE id = '90000000-0000-0000-0000-000000000012'$$,
  'User can delete their own comment'
);

RESET role;


-- ==========================================
-- Test Case 2: A different regular user cannot delete someone else's comment
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000002', true);

SELECT throws_ok(
  $$DELETE FROM public.comments WHERE id = '90000000-0000-0000-0000-000000000013'$$,
  '42501',
  NULL,
  'Different regular user cannot delete someone else''s comment'
);

RESET role;


-- ==========================================
-- Test Case 3: A club admin is allowed to delete comments according to the project's RLS policy
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000003', true);

-- 3a. Club admin can delete their own comment
SELECT lives_ok(
  $$DELETE FROM public.comments WHERE id = '90000000-0000-0000-0000-000000000013'$$,
  'Club admin can delete their own comment'
);

-- 3b. Club admin cannot delete someone else's comment (User B's comment)
SELECT throws_ok(
  $$DELETE FROM public.comments WHERE id = '90000000-0000-0000-0000-000000000014'$$,
  '42501',
  NULL,
  'Club admin cannot delete someone else''s comment'
);

RESET role;

-- Finish the tests and roll back transaction to clean up test data
SELECT * FROM finish();
ROLLBACK;
