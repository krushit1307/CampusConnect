-- ============================================================
-- Test Suite: groups_rls.test.sql
-- Issue: #1352
-- Description: Verifies RLS policies on groups, group_members, and group_posts
--              for unauthenticated users, non-members, members, and group admins.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (8 tests)
SELECT plan(8);

-- Grant schema privileges to authenticated and anon database roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock test users
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('91000000-0000-0000-0000-000000000001', 'grp_admin@test.com', 'authenticated', 'authenticated', '{"full_name": "Group Admin"}'),
  ('91000000-0000-0000-0000-000000000002', 'grp_member@test.com', 'authenticated', 'authenticated', '{"full_name": "Group Member"}'),
  ('91000000-0000-0000-0000-000000000003', 'grp_outsider@test.com', 'authenticated', 'authenticated', '{"full_name": "Group Outsider"}')
ON CONFLICT (id) DO NOTHING;

-- Insert test groups (Public & Private)
INSERT INTO public.groups (id, name, description, is_private, created_by)
VALUES
  ('91000000-0000-0000-0000-000000000010', 'Public Study Group', 'Everyone can view', FALSE, '91000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000011', 'Secret Project Group', 'Members only', TRUE, '91000000-0000-0000-0000-000000000001');

-- Insert memberships: Admin User is admin, Member User is member
INSERT INTO public.group_members (id, group_id, user_id, role, status)
VALUES
  ('91000000-0000-0000-0000-000000000020', '91000000-0000-0000-0000-000000000011', '91000000-0000-0000-0000-000000000001', 'admin', 'approved'),
  ('91000000-0000-0000-0000-000000000021', '91000000-0000-0000-0000-000000000011', '91000000-0000-0000-0000-000000000002', 'member', 'approved');

-- Insert posts in public and private groups
INSERT INTO public.group_posts (id, group_id, author_id, content)
VALUES
  ('91000000-0000-0000-0000-000000000030', '91000000-0000-0000-0000-000000000010', '91000000-0000-0000-0000-000000000001', 'Public post content'),
  ('91000000-0000-0000-0000-000000000031', '91000000-0000-0000-0000-000000000011', '91000000-0000-0000-0000-000000000001', 'Private post content');


-- ==========================================
-- Test 1: Unauthenticated (anon) user CANNOT read private group data
-- ==========================================
SET local role anon;

SELECT is_empty(
  $$SELECT name FROM public.groups WHERE id = '91000000-0000-0000-0000-000000000011'$$,
  'Unauthenticated (anon) users cannot read private group details'
);

SELECT is_empty(
  $$SELECT content FROM public.group_posts WHERE group_id = '91000000-0000-0000-0000-000000000011'$$,
  'Unauthenticated (anon) users cannot read private group posts'
);

RESET role;

-- ==========================================
-- Test 3: Authenticated outsider CANNOT view private group posts
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000003', true);

SELECT is_empty(
  $$SELECT content FROM public.group_posts WHERE group_id = '91000000-0000-0000-0000-000000000011'$$,
  'Non-members cannot query private group posts'
);

RESET role;

-- ==========================================
-- Test 4: Approved group member CAN view private group and private posts
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);

SELECT results_eq(
  $$SELECT content FROM public.group_posts WHERE id = '91000000-0000-0000-0000-000000000031'$$,
  ARRAY['Private post content'],
  'Approved group member can view private group posts'
);

-- ==========================================
-- Test 5: Non-admin member CANNOT update group settings
-- ==========================================
UPDATE public.groups SET description = 'Hacked description' WHERE id = '91000000-0000-0000-0000-000000000011';
SELECT is(
  (SELECT description FROM public.groups WHERE id = '91000000-0000-0000-0000-000000000011'),
  'Members only',
  'Non-admin group member cannot update group settings'
);

RESET role;

-- ==========================================
-- Test 6: Group Admin CAN update group settings
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);

UPDATE public.groups SET description = 'Updated Admin Description' WHERE id = '91000000-0000-0000-0000-000000000011';
SELECT is(
  (SELECT description FROM public.groups WHERE id = '91000000-0000-0000-0000-000000000011'),
  'Updated Admin Description',
  'Group Admin can update group settings'
);

RESET role;

-- ==========================================
-- Test 7: User CAN leave group they belong to
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);

DELETE FROM public.group_members WHERE id = '91000000-0000-0000-0000-000000000021';

SELECT is_empty(
  $$SELECT 1 FROM public.group_members WHERE id = '91000000-0000-0000-0000-000000000021'$$,
  'User can leave group they are a member of'
);

RESET role;

-- ==========================================
-- Test 8: Non-admin CANNOT delete another user membership
-- ==========================================
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000003', true);

DELETE FROM public.group_members WHERE id = '91000000-0000-0000-0000-000000000020';

SELECT is(
  (SELECT COUNT(*)::INT FROM public.group_members WHERE id = '91000000-0000-0000-0000-000000000020'),
  1,
  'Outsider non-admin cannot remove other group members'
);

RESET role;

SELECT * FROM finish();
ROLLBACK;
