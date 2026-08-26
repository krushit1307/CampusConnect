-- Test: Profile RLS Security - Prevent Privilege Escalation
-- Issue #1227: Ensure normal users cannot modify 'role' in profiles table

SELECT plan(4);

-- Setup test data
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000001', 'normal_user@test.com', 'authenticated', 'authenticated', '{"full_name": "Normal User"}'),
  ('90000000-0000-0000-0000-000000000002', 'system_admin@test.com', 'authenticated', 'authenticated', '{"full_name": "System Admin"}')
ON CONFLICT (id) DO NOTHING;

-- Set roles in profiles
UPDATE public.profiles SET role = 'student' WHERE id = '90000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET role = 'system_admin' WHERE id = '90000000-0000-0000-0000-000000000002';

-- Test 1: Normal user can update safe fields (bio)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '90000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET bio = 'Updated bio' WHERE id = '90000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT bio FROM public.profiles WHERE id = '90000000-0000-0000-0000-000000000001'),
  'Updated bio',
  'Normal user can update bio'
);

-- Test 2: Normal user cannot update role (privilege escalation blocked)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '90000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET role = 'system_admin' WHERE id = '90000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT role::TEXT FROM public.profiles WHERE id = '90000000-0000-0000-0000-000000000001'),
  'student',
  'Normal user cannot update role (blocked)'
);

-- Test 3: System admin can update role
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '90000000-0000-0000-0000-000000000002';
UPDATE public.profiles SET role = 'club_admin' WHERE id = '90000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT role::TEXT FROM public.profiles WHERE id = '90000000-0000-0000-0000-000000000001'),
  'club_admin',
  'System admin can update role'
);

-- Test 4: Normal user can update avatar_url
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '90000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET avatar_url = 'https://example.com/avatar.jpg' WHERE id = '90000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT avatar_url FROM public.profiles WHERE id = '90000000-0000-0000-0000-000000000001'),
  'https://example.com/avatar.jpg',
  'Normal user can update avatar_url'
);

-- Cleanup
RESET ROLE;
UPDATE public.profiles SET role = 'student' WHERE id = '90000000-0000-0000-0000-000000000001';
DELETE FROM auth.users WHERE id IN ('90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002');

SELECT * FROM finish();
