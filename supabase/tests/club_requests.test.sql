-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 4 tests)
SELECT plan(4);

-- Grant privileges to authenticated role so that table-level permissions do not interfere with RLS testing
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- ==========================================
-- 1. Setup mock data
-- ==========================================

-- Create test users
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000001001', 'member1@test.com', 'authenticated', 'authenticated', '{"full_name": "Member 1"}'),
  ('90000000-0000-0000-0000-000000001002', 'member2@test.com', 'authenticated', 'authenticated', '{"full_name": "Member 2"}'),
  ('90000000-0000-0000-0000-000000001003', 'admin@test.com', 'authenticated', 'authenticated', '{"full_name": "Admin User"}')
ON CONFLICT (id) DO NOTHING;

-- Insert a test club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000001004', 'Test Club Requests', 'test-club-requests', 'A club for testing requests', '90000000-0000-0000-0000-000000001003');

-- Insert club roles (Admin and Member) for our test club
INSERT INTO public.club_roles (id, club_id, title, permissions_level)
VALUES 
  ('90000000-0000-0000-0000-000000001005', '90000000-0000-0000-0000-000000001004', 'Admin', 100),
  ('90000000-0000-0000-0000-000000001006', '90000000-0000-0000-0000-000000001004', 'Member', 10);

-- Make the creator an admin (approved member)
INSERT INTO public.club_members (id, club_id, user_id, role_id, status)
VALUES ('90000000-0000-0000-0000-000000001007', '90000000-0000-0000-0000-000000001004', '90000000-0000-0000-0000-000000001003', '90000000-0000-0000-0000-000000001005', 'approved');

-- ==========================================
-- 2. Test Unique Constraint on Club Requests
-- ==========================================

-- Test 1: Insert first pending membership request (should succeed)
SELECT lives_ok(
  $$INSERT INTO public.club_members (id, club_id, user_id, role_id, status) VALUES ('90000000-0000-0000-0000-000000001008', '90000000-0000-0000-0000-000000001004', '90000000-0000-0000-0000-000000001001', '90000000-0000-0000-0000-000000001006', 'pending')$$,
  'User can create a pending membership request'
);

-- Test 2: Insert second pending membership request for same user/club (should fail unique constraint)
SELECT throws_ok(
  $$INSERT INTO public.club_members (id, club_id, user_id, role_id, status) VALUES ('90000000-0000-0000-0000-000000001009', '90000000-0000-0000-0000-000000001004', '90000000-0000-0000-0000-000000001001', '90000000-0000-0000-0000-000000001006', 'pending')$$,
  '23505',
  NULL,
  'Duplicate pending membership requests are blocked'
);

-- ==========================================
-- 3. Test RLS on Role Updates
-- ==========================================

-- Make Member 2 an approved member so they can try to update roles
INSERT INTO public.club_members (id, club_id, user_id, role_id, status)
VALUES ('90000000-0000-0000-0000-000000001010', '90000000-0000-0000-0000-000000001004', '90000000-0000-0000-0000-000000001002', '90000000-0000-0000-0000-000000001006', 'approved');

-- Switch context to authenticated Member 2 (non-admin)
SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000001002', true);

-- Test 3: Non-admin cannot update role (RLS should block it, leaving role unchanged)
UPDATE public.club_members SET role_id = '90000000-0000-0000-0000-000000001005' WHERE id = '90000000-0000-0000-0000-000000001008';

SELECT is(
  (SELECT role_id FROM public.club_members WHERE id = '90000000-0000-0000-0000-000000001008'),
  '90000000-0000-0000-0000-000000001006'::uuid,
  'Non-admin cannot update membership roles (RLS blocks update)'
);

-- Switch context to Admin User
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000001003', true);

-- Test 4: Admin can update role
UPDATE public.club_members SET role_id = '90000000-0000-0000-0000-000000001005' WHERE id = '90000000-0000-0000-0000-000000001008';

SELECT is(
  (SELECT role_id FROM public.club_members WHERE id = '90000000-0000-0000-0000-000000001008'),
  '90000000-0000-0000-0000-000000001005'::uuid,
  'Admin can update membership roles'
);

-- Reset back to postgres superuser role and finish
RESET role;
SELECT * FROM finish();

ROLLBACK;
