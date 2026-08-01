-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(4);

-- Grant privileges to authenticated role so that table-level permissions do not interfere with RLS testing
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock data
-- Create test users in auth.users
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000201', 'author@test.com', 'authenticated', 'authenticated', '{"full_name": "Author User"}')
ON CONFLICT (id) DO NOTHING;

-- Create a club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000202', 'Test Trending Club', 'test-trending-club', 'A club for testing trending', '90000000-0000-0000-0000-000000000201');

-- Insert discussion posts with hashtags
INSERT INTO public.posts (id, club_id, author_id, content, created_at)
VALUES
  -- #sports used 3 times (case-insensitive #Sports, #SPORTS)
  ('90000000-0000-0000-0000-000000000203', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000201', 'Love playing #Sports on weekends!', NOW() - INTERVAL '1 hour'),
  ('90000000-0000-0000-0000-000000000204', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000201', 'The #SPORTS club is recruiting new members.', NOW() - INTERVAL '5 hours'),
  ('90000000-0000-0000-0000-000000000205', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000201', 'Watching some #sports today.', NOW() - INTERVAL '10 hours'),
  
  -- #music used 2 times
  ('90000000-0000-0000-0000-000000000206', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000201', 'Listening to new #music releases.', NOW() - INTERVAL '12 hours'),
  ('90000000-0000-0000-0000-000000000207', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000201', 'Live #music concert tonight!', NOW() - INTERVAL '20 hours'),
  
  -- #coding used 1 time
  ('90000000-0000-0000-0000-000000000208', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000201', 'Late night #coding session.', NOW() - INTERVAL '2 hours'),
  
  -- #old_tag used 4 times but created 50 hours ago (beyond the 48-hour limit)
  ('90000000-0000-0000-0000-000000000209', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000201', 'This is an #old_tag from last week.', NOW() - INTERVAL '50 hours'),
  ('90000000-0000-0000-0000-000000000210', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000201', 'Still talking about #old_tag.', NOW() - INTERVAL '52 hours'),
  ('90000000-0000-0000-0000-000000000211', '90000000-0000-0000-0000-000000000202', '90000000-0000-0000-0000-000000000201', 'Another post about #old_tag.', NOW() - INTERVAL '53 hours');


-- ==========================================
-- Test Case 1: get_trending_hashtags returns expected rows count
-- ==========================================
SELECT results_eq(
  $$SELECT COUNT(*)::integer FROM public.get_trending_hashtags()$$,
  $$VALUES (3)$$,
  'Should return exactly 3 hashtags within the last 48 hours'
);

-- ==========================================
-- Test Case 2: get_trending_hashtags extracts tags correctly and groups them case-insensitively in lowercase
-- ==========================================
SELECT set_has(
  $$SELECT hashtag FROM public.get_trending_hashtags()$$,
  $$VALUES ('sports'), ('music'), ('coding')$$,
  'Should return sports, music, and coding hashtags normalized to lowercase'
);

-- ==========================================
-- Test Case 3: get_trending_hashtags orders by frequency (count DESC)
-- ==========================================
SELECT results_eq(
  $$SELECT hashtag, count FROM public.get_trending_hashtags() LIMIT 2$$,
  $$VALUES ('sports', 3::bigint), ('music', 2::bigint)$$,
  'Should return sports (3) and music (2) as the top two trending tags'
);

-- ==========================================
-- Test Case 4: get_trending_hashtags filters out tags older than 48 hours
-- ==========================================
SELECT throws_ok(
  $$SELECT 1 / (NOT EXISTS (SELECT 1 FROM public.get_trending_hashtags() WHERE hashtag = 'old_tag'))::integer$$,
  NULL,
  NULL,
  'Should filter out hashtags older than 48 hours'
);

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
