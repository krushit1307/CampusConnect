-- =====================================================================
-- pgTAP tests for the dynamic crowd-sourced event rating system
--
-- Target: supabase/migrations/20261128000000_event_feedback_metrics.sql
-- Run with:
--   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--        -f supabase/tests/event_feedback_metrics.test.sql
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

-- We run 8 assertions
SELECT plan(8);

-- ---------------------------------------------------------------------
-- Setup mock data
-- ---------------------------------------------------------------------

INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('92000000-0000-0000-0000-000000000700', 'metrics-organizer@test.com', 'authenticated', 'authenticated', '{"full_name": "Metrics Organizer"}'),
  ('92000000-0000-0000-0000-000000000701', 'metrics-attendee@test.com', 'authenticated', 'authenticated', '{"full_name": "Metrics Attendee"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('92000000-0000-0000-0000-000000000710', 'Metrics Test Club', 'metrics-test-club', 'Club for testing rating metrics', '92000000-0000-0000-0000-000000000700')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, description, start_date, end_date, location, created_by, status, rating_metrics)
VALUES ('92000000-0000-0000-0000-000000000711', '92000000-0000-0000-0000-000000000710', 'Metrics Event', 'Event for rating', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'Room A', '92000000-0000-0000-0000-000000000700', 'active', '["Food Quality", "Networking Value"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- The attendee is checked-in, satisfying the INSERT policy.
INSERT INTO public.event_rsvps (event_id, user_id, checked_in, status)
VALUES ('92000000-0000-0000-0000-000000000711', '92000000-0000-0000-0000-000000000701', TRUE, 'approved')
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Insert metric scores directly (bypasses RLS as the table owner).
INSERT INTO public.event_feedback_metrics (event_id, user_id, metric_name, score)
VALUES
  ('92000000-0000-0000-0000-000000000711', '92000000-0000-0000-0000-000000000701', 'Food Quality', 80),
  ('92000000-0000-0000-0000-000000000711', '92000000-0000-0000-0000-000000000701', 'Networking Value', 60)
ON CONFLICT (event_id, user_id, metric_name) DO NOTHING;

-- Simulate the authenticated organizer for auth.uid().
SELECT set_config('request.jwt.claims', '{"sub": "92000000-0000-0000-0000-000000000700", "role": "authenticated"}', true);

-- ---------------------------------------------------------------------
-- Test 1: The table exists
-- ---------------------------------------------------------------------
SELECT has_table('public', 'event_feedback_metrics', 'event_feedback_metrics table should exist');

-- ---------------------------------------------------------------------
-- Test 2: events.rating_metrics column exists
-- ---------------------------------------------------------------------
SELECT has_column('public', 'events', 'rating_metrics', 'events.rating_metrics column should exist');

-- ---------------------------------------------------------------------
-- Test 3: The score CHECK constraint enforces the 0-100 range
-- ---------------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.event_feedback_metrics (event_id, user_id, metric_name, score)
    VALUES ('92000000-0000-0000-0000-000000000711', '92000000-0000-0000-0000-000000000701', 'Bad Score', 101)$$,
  '23514',
  NULL,
  'score above 100 should be rejected'
);

-- ---------------------------------------------------------------------
-- Test 4: The UNIQUE(event_id, user_id, metric_name) constraint
-- ---------------------------------------------------------------------
SELECT throws_ok(
  $$INSERT INTO public.event_feedback_metrics (event_id, user_id, metric_name, score)
    VALUES ('92000000-0000-0000-0000-000000000711', '92000000-0000-0000-0000-000000000701', 'Food Quality', 75)$$,
  '23505',
  NULL,
  'duplicate metric for the same event+user should be rejected'
);

-- ---------------------------------------------------------------------
-- Test 5: RLS is enabled
-- ---------------------------------------------------------------------
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.event_feedback_metrics'::regclass),
  true,
  'event_feedback_metrics should have RLS enabled'
);

-- ---------------------------------------------------------------------
-- Test 6: The summary RPC exists
-- ---------------------------------------------------------------------
SELECT has_function(
  'public',
  'get_event_feedback_metrics_summary',
  ARRAY['uuid']::text[],
  'get_event_feedback_metrics_summary(UUID) should exist'
);

-- ---------------------------------------------------------------------
-- Test 7: The summary RPC aggregates averages per metric
-- ---------------------------------------------------------------------
SELECT is(
  (
    SELECT (metric::jsonb ->> 'average_score')::numeric
    FROM json_array_elements(
      (get_event_feedback_metrics_summary('92000000-0000-0000-0000-000000000711')::jsonb -> 'metrics')
    ) AS metric
    WHERE metric::jsonb ->> 'metric_name' = 'Food Quality'
  ),
  80.00::numeric,
  'Food Quality average_score should be 80.00'
);

-- ---------------------------------------------------------------------
-- Test 8: Unauthorized callers are rejected
-- ---------------------------------------------------------------------
-- Simulate a non-organizer caller.
SELECT set_config('request.jwt.claims', '{"sub": "92000000-0000-0000-0000-000000000701", "role": "authenticated"}', true);

SELECT throws_ok(
  $$SELECT public.get_event_feedback_metrics_summary('92000000-0000-0000-0000-000000000711')$$,
  NULL,
  'Not authorized to view feedback metrics',
  'non-organizer should be rejected by the summary RPC'
);

-- ---------------------------------------------------------------------
-- Finish and clean up (ROLLBACK discards all inserted test data)
-- ---------------------------------------------------------------------
SELECT * FROM finish();
ROLLBACK;