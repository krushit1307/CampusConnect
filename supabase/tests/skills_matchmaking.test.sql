-- pgTAP Test: Skills Matchmaking
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(3);

-- Setup test data
-- Insert test users in auth.users (triggers public.profiles creation)
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('80000000-0000-0000-0000-000000000001', 'user1@test.com', 'authenticated', 'authenticated', '{"full_name": "User One"}'),
  ('80000000-0000-0000-0000-000000000002', 'user2@test.com', 'authenticated', 'authenticated', '{"full_name": "User Two"}'),
  ('80000000-0000-0000-0000-000000000003', 'user3@test.com', 'authenticated', 'authenticated', '{"full_name": "User Three"}')
ON CONFLICT (id) DO NOTHING;

-- Populate skills for the test profiles
UPDATE public.profiles SET skills = ARRAY['React', 'Node', 'TypeScript'] WHERE id = '80000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET skills = ARRAY['Node', 'Python'] WHERE id = '80000000-0000-0000-0000-000000000002';
UPDATE public.profiles SET skills = ARRAY['React', 'TypeScript', 'Docker', 'Go'] WHERE id = '80000000-0000-0000-0000-000000000003';

-- Test 1: User One matching results are sorted by overlap (User Three has 2, User Two has 1)
SELECT results_eq(
  $$ SELECT id, match_count FROM public.get_recommended_connections('80000000-0000-0000-0000-000000000001', 5) $$,
  $$ VALUES 
    ('80000000-0000-0000-0000-000000000003'::UUID, 2),
    ('80000000-0000-0000-0000-000000000002'::UUID, 1)
  $$,
  'get_recommended_connections returns correct overlap match count and sorted order'
);

-- Test 2: limit_count parameter successfully limits result count
SELECT is(
  (SELECT COUNT(*)::INT FROM public.get_recommended_connections('80000000-0000-0000-0000-000000000001', 1)),
  1,
  'get_recommended_connections respects limit_count'
);

-- Test 3: empty user skills returns no recommendations
UPDATE public.profiles SET skills = '{}'::TEXT[] WHERE id = '80000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT COUNT(*)::INT FROM public.get_recommended_connections('80000000-0000-0000-0000-000000000001', 5)),
  0,
  'get_recommended_connections returns 0 rows if caller profile has empty skills array'
);

SELECT * FROM finish();
ROLLBACK;
