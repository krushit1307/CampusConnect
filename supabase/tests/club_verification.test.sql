-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 5 tests)
SELECT plan(5);

-- Grant privileges to authenticated role so that table-level permissions do not interfere with RLS testing
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Test 1: Check column is_verified exists on clubs table
SELECT has_column('public', 'clubs', 'is_verified', 'Column is_verified should exist on clubs table');

-- Test 2: Check column default value is false
SELECT col_default_is('public', 'clubs', 'is_verified', false, 'Default is_verified should be false');

-- ==========================================
-- Setup mock data
-- ==========================================

INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000011', 'clubadmin_verif@test.com', 'authenticated', 'authenticated', '{"full_name": "Club Admin Verif"}'),
  ('90000000-0000-0000-0000-000000000012', 'sysadmin_verif@test.com', 'authenticated', 'authenticated', '{"full_name": "System Admin Verif"}')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles SET role = 'club_admin' WHERE id = '90000000-0000-0000-0000-000000000011';
UPDATE public.profiles SET role = 'system_admin' WHERE id = '90000000-0000-0000-0000-000000000012';

-- Club created by the club_admin user
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000013', 'Verification Test Club', 'verification-test-club', 'A club for testing verification', '90000000-0000-0000-0000-000000000011');

-- ==========================================
-- Test 3: Club admin (creator) cannot set is_verified to TRUE via UPDATE
-- ==========================================

SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000011', true);

SELECT throws_ok(
  $$UPDATE public.clubs SET is_verified = true WHERE id = '90000000-0000-0000-0000-000000000013'$$,
  'P0001',
  'Only system admins can change club verification status.',
  'Club admin cannot set is_verified to true via UPDATE'
);

RESET role;

-- ==========================================
-- Test 4: System admin can set is_verified to TRUE via UPDATE
-- ==========================================

SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000012', true);

SELECT lives_ok(
  $$UPDATE public.clubs SET is_verified = true WHERE id = '90000000-0000-0000-0000-000000000013'$$,
  'System admin can set is_verified to true via UPDATE'
);

RESET role;

-- ==========================================
-- Test 5: Club admin cannot INSERT a new club with is_verified = true
-- ==========================================

SET local role authenticated;
SELECT set_config('request.jwt.claim.sub', '90000000-0000-0000-0000-000000000011', true);

SELECT throws_ok(
  $$INSERT INTO public.clubs (name, slug, created_by, is_verified) VALUES ('Sneaky Club', 'sneaky-club', '90000000-0000-0000-0000-000000000011', true)$$,
  'P0001',
  'Only system admins can set club verification status.',
  'Club admin cannot insert a club with is_verified = true'
);

RESET role;

-- Finish tests and clean up
SELECT * FROM finish();
ROLLBACK;
