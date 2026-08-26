-- ============================================================
-- Test Suite: api_rate_limiting.test.sql
-- Description: Verifies the database-level rate limiting triggers,
--              sliding-window checks, and block duration logic.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (8 tests)
SELECT plan(8);

-- Test 1: Verify tables exist
SELECT has_table('public', 'api_rate_limits', 'Table public.api_rate_limits should exist');
SELECT has_table('public', 'api_rate_log', 'Table public.api_rate_log should exist');

-- Test 2: Verify trigger function exists
SELECT has_function(
  'public',
  'check_api_rate_limit',
  'Function public.check_api_rate_limit() should exist'
);

-- Setup mock data (user, club, event)
INSERT INTO auth.users (id, email, aud, role)
VALUES ('b0000000-0000-0000-0000-000000000001', 'spammer@cc.edu', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('b0000000-0000-0000-0000-000000000002', 'Rate Limit Club', 'rate-limit-club', 'b0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, location, created_by, event_date)
VALUES ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'Test Rate Event', 'Room 10', 'b0000000-0000-0000-0000-000000000001', NOW() + INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- Simulate requests under the threshold (15 insert logs)
-- Directly insert to rate log for user to save test execution time
INSERT INTO public.api_rate_log (user_id, created_at)
SELECT 'b0000000-0000-0000-0000-000000000001'::uuid, NOW() - (val || ' seconds')::interval
FROM generate_series(1, 15) AS val;

-- Test 3: Insert should succeed under limit (15 < 20 threshold)
-- Set session identity
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001"}', true);

SELECT lives_ok(
  $$
  INSERT INTO public.posts (id, club_id, author_id, content)
  VALUES (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Post under rate threshold');
  $$,
  'Post insertion succeeds under the 20-insert per minute threshold'
);

-- Add 5 more log entries to hit threshold limit (15 + 1 new insert + 5 more = 21 > 20 threshold)
INSERT INTO public.api_rate_log (user_id, created_at)
SELECT 'b0000000-0000-0000-0000-000000000001'::uuid, NOW() - (val || ' seconds')::interval
FROM generate_series(1, 5) AS val;

-- Test 4: Verify exception thrown on 21st write attempt
SELECT throws_ok(
  $$
  INSERT INTO public.posts (id, club_id, author_id, content)
  VALUES (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Spam post exceeding rate limits');
  $$,
  'RL001',
  NULL,
  'Spam posts trigger rate limiting exception (RL001)'
);

-- Test 5: Verify user is blocked in the database
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.api_rate_limits
    WHERE user_id = 'b0000000-0000-0000-0000-000000000001'
      AND blocked_until > NOW()
  ),
  'Spammer user should be marked as blocked in api_rate_limits table'
);

-- Test 6: Verify blocked user cannot insert new comments
SELECT throws_ok(
  $$
  INSERT INTO public.comments (id, post_id, author_id, content)
  VALUES (gen_random_uuid(), (SELECT id FROM public.posts LIMIT 1), 'b0000000-0000-0000-0000-000000000001', 'Spam comment during block');
  $$,
  'RL001',
  NULL,
  'Comment insertion by blocked user fails with exception (RL001)'
);

-- Test 7: Verify blocked user cannot RSVP to events
SELECT throws_ok(
  $$
  INSERT INTO public.event_rsvps (id, event_id, user_id)
  VALUES (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001');
  $$,
  'RL001',
  NULL,
  'RSVP insertion by blocked user fails with exception (RL001)'
);

SELECT * FROM finish();
ROLLBACK;
