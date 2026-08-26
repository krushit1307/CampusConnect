-- pgTAP Test: Dynamic Club Roles
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(8);

-- Test 1: Check club_roles table exists
SELECT has_table('public', 'club_roles', 'Table club_roles should exist');

-- Test 2-5: Check columns on club_roles table
SELECT has_column('public', 'club_roles', 'id', 'Column id should exist on club_roles');
SELECT has_column('public', 'club_roles', 'club_id', 'Column club_id should exist on club_roles');
SELECT has_column('public', 'club_roles', 'title', 'Column title should exist on club_roles');
SELECT has_column('public', 'club_roles', 'permissions_level', 'Column permissions_level should exist on club_roles');

-- Setup test users
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('80000000-0000-0000-0000-000000000001', 'admin@test.com', 'authenticated', 'authenticated', '{"full_name": "Admin User"}'),
       ('80000000-0000-0000-0000-000000000002', 'member@test.com', 'authenticated', 'authenticated', '{"full_name": "Member User"}')
ON CONFLICT (id) DO NOTHING;

-- Insert club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('80000000-0000-0000-0000-000000000003', 'Role Test Club', 'role-test-club', 'Testing roles', '80000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Insert roles
INSERT INTO public.club_roles (id, club_id, title, permissions_level)
VALUES ('80000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000003', 'President', 100),
       ('80000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000003', 'Member', 10)
ON CONFLICT (id) DO NOTHING;

-- Insert member and admin
INSERT INTO public.club_members (user_id, club_id, role_id, status)
VALUES ('80000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000004', 'approved'),
       ('80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000005', 'approved')
ON CONFLICT (user_id, club_id) DO UPDATE SET role_id = EXCLUDED.role_id;

-- Test 6: Check is_club_admin works for level >= 100
SELECT set_config('request.jwt.claims', '{"sub": "80000000-0000-0000-0000-000000000001"}', true);
SELECT is(
  public.is_club_admin('80000000-0000-0000-0000-000000000003'),
  true,
  'User with permissions_level >= 100 is identified as club admin'
);

-- Test 7: Check is_club_admin does not work for level < 100
SELECT set_config('request.jwt.claims', '{"sub": "80000000-0000-0000-0000-000000000002"}', true);
SELECT is(
  public.is_club_admin('80000000-0000-0000-0000-000000000003'),
  false,
  'Regular member is not identified as club admin'
);

-- Test 8: Check trigger assigns default role when role_id is NULL
INSERT INTO auth.users (id, email, aud, role) VALUES ('80000000-0000-0000-0000-000000000006', 'default@test.com', 'authenticated', 'authenticated') ON CONFLICT DO NOTHING;
INSERT INTO public.club_members (user_id, club_id, status)
VALUES ('80000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000003', 'approved');

SELECT ok(
  (SELECT role_id IS NOT NULL FROM public.club_members WHERE user_id = '80000000-0000-0000-0000-000000000006' AND club_id = '80000000-0000-0000-0000-000000000003'),
  'Trigger assigns default club role when role_id is NULL'
);

SELECT * FROM finish();
ROLLBACK;
