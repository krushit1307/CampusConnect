-- =====================================================================
-- pgTAP tests for the event discovery RPC: public.get_upcoming_events_feed
--
-- Target: supabase/migrations/20260718000008_upcoming_events_feed_rpc.sql
-- Run with:
--   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--        -f supabase/tests/upcoming_events_feed_rpc.test.sql
-- =====================================================================

BEGIN;

-- Ensure the pgTAP extension is available
CREATE EXTENSION IF NOT EXISTS pgtap;

-- We run 6 assertions
SELECT plan(6);

-- ---------------------------------------------------------------------
-- Setup mock data
-- ---------------------------------------------------------------------

-- Test users: the caller + two users who RSVP to events.
-- Inserting into auth.users also creates the matching public.profiles row.
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000700', 'feed-caller@test.com',    'authenticated', 'authenticated', '{"full_name": "Feed Caller"}'),
  ('90000000-0000-0000-0000-000000000701', 'feed-rsvp-1@test.com',    'authenticated', 'authenticated', '{"full_name": "RSVP User 1"}'),
  ('90000000-0000-0000-0000-000000000702', 'feed-rsvp-2@test.com',    'authenticated', 'authenticated', '{"full_name": "RSVP User 2"}')
ON CONFLICT (id) DO NOTHING;

-- A club to host the test events.
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000703', 'Feed Test Club', 'feed-test-club', 'A club for testing the event discovery feed', '90000000-0000-0000-0000-000000000700')
ON CONFLICT (id) DO NOTHING;

-- Events:
--   * early   -> upcoming, starts in 2 days
--   * later   -> upcoming, starts in 5 days (RSVPs + saved state target)
--   * past    -> starts yesterday (must be excluded: start_date >= NOW())
--   * canceled-> upcoming but status = 'canceled' (must be excluded)
INSERT INTO public.events (id, club_id, title, description, start_date, location, created_by, status)
VALUES
  ('90000000-0000-0000-0000-000000000704', '90000000-0000-0000-0000-000000000703', 'Feed Event Early',  'First upcoming event',  NOW() + INTERVAL '2 days', 'Room A', '90000000-0000-0000-0000-000000000700', 'scheduled'),
  ('90000000-0000-0000-0000-000000000705', '90000000-0000-0000-0000-000000000703', 'Feed Event Later',  'Second upcoming event', NOW() + INTERVAL '5 days', 'Room B', '90000000-0000-0000-0000-000000000700', 'scheduled'),
  ('90000000-0000-0000-0000-000000000706', '90000000-0000-0000-0000-000000000703', 'Feed Event Past',   'Already happened',      NOW() - INTERVAL '1 day',  'Room C', '90000000-0000-0000-0000-000000000700', 'scheduled'),
  ('90000000-0000-0000-0000-000000000707', '90000000-0000-0000-0000-000000000703', 'Feed Event Canceled', 'Canceled event',      NOW() + INTERVAL '3 days', 'Room D', '90000000-0000-0000-0000-000000000700', 'canceled')
ON CONFLICT (id) DO NOTHING;

-- Two RSVPs on the "later" event (distinct users to satisfy the UNIQUE constraint).
INSERT INTO public.event_rsvps (event_id, user_id, status)
VALUES
  ('90000000-0000-0000-0000-000000000705', '90000000-0000-0000-0000-000000000701', 'approved'),
  ('90000000-0000-0000-0000-000000000705', '90000000-0000-0000-0000-000000000702', 'approved')
ON CONFLICT (event_id, user_id) DO NOTHING;

-- The caller has bookmarked the "early" event.
INSERT INTO public.saved_events (event_id, user_id)
VALUES ('90000000-0000-0000-0000-000000000704', '90000000-0000-0000-0000-000000000700')
ON CONFLICT (event_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Test 1: The function exists with the expected signature
-- ---------------------------------------------------------------------
SELECT has_function(
  'public',
  'get_upcoming_events_feed',
  ARRAY['uuid']::text[],
  'get_upcoming_events_feed(UUID) should exist'
);

-- ---------------------------------------------------------------------
-- Test 2: The function returns a table
-- ---------------------------------------------------------------------
SELECT function_returns(
  'public',
  'get_upcoming_events_feed',
  ARRAY['uuid']::text[],
  'table',
  'get_upcoming_events_feed should return a table'
);

-- ---------------------------------------------------------------------
-- Test 3: Only upcoming, non-canceled events are returned,
--         ordered by start_date ascending.
--         (Past + canceled events must NOT appear.)
-- ---------------------------------------------------------------------
SELECT results_eq(
  $$ SELECT title
     FROM public.get_upcoming_events_feed('90000000-0000-0000-0000-000000000700')
     WHERE title IN ('Feed Event Early', 'Feed Event Later', 'Feed Event Past', 'Feed Event Canceled') $$,
  $$ VALUES
       ('Feed Event Early'::text),
       ('Feed Event Later'::text)
  $$,
  'Only upcoming, non-canceled events are returned, ordered by start date'
);

-- ---------------------------------------------------------------------
-- Test 4: rsvp_count reflects the total number of RSVPs
-- ---------------------------------------------------------------------
SELECT is(
  (SELECT rsvp_count::bigint
   FROM public.get_upcoming_events_feed('90000000-0000-0000-0000-000000000700')
   WHERE title = 'Feed Event Later'),
  2::bigint,
  'rsvp_count equals the number of RSVPs on the event'
);

-- ---------------------------------------------------------------------
-- Test 5: is_bookmarked is TRUE when the caller has saved the event
-- ---------------------------------------------------------------------
SELECT is(
  (SELECT is_bookmarked
   FROM public.get_upcoming_events_feed('90000000-0000-0000-0000-000000000700')
   WHERE title = 'Feed Event Early'),
  true,
  'is_bookmarked is TRUE for an event saved by the caller'
);

-- ---------------------------------------------------------------------
-- Test 6: is_bookmarked is FALSE when the caller has not saved the event
-- ---------------------------------------------------------------------
SELECT is(
  (SELECT is_bookmarked
   FROM public.get_upcoming_events_feed('90000000-0000-0000-0000-000000000700')
   WHERE title = 'Feed Event Later'),
  false,
  'is_bookmarked is FALSE for an event not saved by the caller'
);

-- ---------------------------------------------------------------------
-- Finish and clean up (ROLLBACK discards all inserted test data)
-- ---------------------------------------------------------------------
SELECT * FROM finish();
ROLLBACK;
