-- =====================================================================
-- pgTAP tests for the attendance aggregation RPC:
--   public.get_club_attendance_stats(UUID)
--
-- Target: supabase/migrations/20260805110000_club_attendance_stats_rpc.sql
-- Run with:
--   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--        -f supabase/tests/club_attendance_stats_rpc.test.sql
-- =====================================================================

BEGIN;

-- Ensure the pgTAP extension is available
CREATE EXTENSION IF NOT EXISTS pgtap;

-- We run 6 assertions
SELECT plan(6);

-- ---------------------------------------------------------------------
-- Setup mock data
-- ---------------------------------------------------------------------

-- Test users: the caller (club owner) + RSVP users.
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('91000000-0000-0000-0000-000000000700', 'stats-caller@test.com', 'authenticated', 'authenticated', '{"full_name": "Stats Caller"}'),
  ('91000000-0000-0000-0000-000000000701', 'stats-rsvp-1@test.com', 'authenticated', 'authenticated', '{"full_name": "RSVP User 1"}'),
  ('91000000-0000-0000-0000-000000000702', 'stats-rsvp-2@test.com', 'authenticated', 'authenticated', '{"full_name": "RSVP User 2"}'),
  ('91000000-0000-0000-0000-000000000703', 'stats-rsvp-3@test.com', 'authenticated', 'authenticated', '{"full_name": "RSVP User 3"}'),
  ('91000000-0000-0000-0000-000000000704', 'stats-rsvp-4@test.com', 'authenticated', 'authenticated', '{"full_name": "RSVP User 4"}'),
  ('91000000-0000-0000-0000-000000000705', 'stats-rsvp-5@test.com', 'authenticated', 'authenticated', '{"full_name": "RSVP User 5"}'),
  ('91000000-0000-0000-0000-000000000706', 'stats-rsvp-6@test.com', 'authenticated', 'authenticated', '{"full_name": "RSVP User 6"}'),
  ('91000000-0000-0000-0000-000000000707', 'stats-rsvp-7@test.com', 'authenticated', 'authenticated', '{"full_name": "RSVP User 7"}')
ON CONFLICT (id) DO NOTHING;

-- A club owned by the caller.
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('91000000-0000-0000-0000-000000000710', 'Stats Test Club', 'stats-test-club', 'Club for testing attendance aggregation', '91000000-0000-0000-0000-000000000700')
ON CONFLICT (id) DO NOTHING;

-- Events with RSVP counts: 0 (none), 7, 3, 2, and 3.
--   average = (7 + 3 + 2 + 3) / 4 = 3.75
--   median  = PERCENTILE_CONT(0.5) of (2,3,3,7) = 3.00
INSERT INTO public.events (id, club_id, title, description, start_date, location, created_by, status)
VALUES
  ('91000000-0000-0000-0000-000000000711', '91000000-0000-0000-0000-000000000710', 'Stats Event Zero',    'No RSVPs',    NOW() + INTERVAL '1 day', 'Room A', '91000000-0000-0000-0000-000000000700', 'active'),
  ('91000000-0000-0000-0000-000000000712', '91000000-0000-0000-0000-000000000710', 'Stats Event Seven',   'Seven RSVPs', NOW() + INTERVAL '2 days', 'Room B', '91000000-0000-0000-0000-000000000700', 'active'),
  ('91000000-0000-0000-0000-000000000713', '91000000-0000-0000-0000-000000000710', 'Stats Event Three',   'Three RSVPs', NOW() + INTERVAL '3 days', 'Room C', '91000000-0000-0000-0000-000000000700', 'active'),
  ('91000000-0000-0000-0000-000000000714', '91000000-0000-0000-0000-000000000710', 'Stats Event Two',     'Two RSVPs',   NOW() + INTERVAL '4 days', 'Room D', '91000000-0000-0000-0000-000000000700', 'active'),
  ('91000000-0000-0000-0000-000000000715', '91000000-0000-0000-0000-000000000710', 'Stats Event Three B', 'Three RSVPs', NOW() + INTERVAL '5 days', 'Room E', '91000000-0000-0000-0000-000000000700', 'active')
ON CONFLICT (id) DO NOTHING;

-- 7 RSVPs on event 712 (users 701-707), 3 on event 713 (701-703),
-- 2 on event 714 (701-702), 3 on event 715 (701-703).
INSERT INTO public.event_rsvps (event_id, user_id, status)
VALUES
  ('91000000-0000-0000-0000-000000000712', '91000000-0000-0000-0000-000000000701', 'approved'),
  ('91000000-0000-0000-0000-000000000712', '91000000-0000-0000-0000-000000000702', 'approved'),
  ('91000000-0000-0000-0000-000000000712', '91000000-0000-0000-0000-000000000703', 'approved'),
  ('91000000-0000-0000-0000-000000000712', '91000000-0000-0000-0000-000000000704', 'approved'),
  ('91000000-0000-0000-0000-000000000712', '91000000-0000-0000-0000-000000000705', 'approved'),
  ('91000000-0000-0000-0000-000000000712', '91000000-0000-0000-0000-000000000706', 'approved'),
  ('91000000-0000-0000-0000-000000000712', '91000000-0000-0000-0000-000000000707', 'approved'),
  ('91000000-0000-0000-0000-000000000713', '91000000-0000-0000-0000-000000000701', 'approved'),
  ('91000000-0000-0000-0000-000000000713', '91000000-0000-0000-0000-000000000702', 'approved'),
  ('91000000-0000-0000-0000-000000000713', '91000000-0000-0000-0000-000000000703', 'approved'),
  ('91000000-0000-0000-0000-000000000714', '91000000-0000-0000-0000-000000000701', 'approved'),
  ('91000000-0000-0000-0000-000000000714', '91000000-0000-0000-0000-000000000702', 'approved'),
  ('91000000-0000-0000-0000-000000000715', '91000000-0000-0000-0000-000000000701', 'approved'),
  ('91000000-0000-0000-0000-000000000715', '91000000-0000-0000-0000-000000000702', 'approved'),
  ('91000000-0000-0000-0000-000000000715', '91000000-0000-0000-0000-000000000703', 'approved')
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Simulate the authenticated caller for auth.uid() (club owner).
SELECT set_config('request.jwt.claims', '{"sub": "91000000-0000-0000-0000-000000000700", "role": "authenticated"}', true);

-- ---------------------------------------------------------------------
-- Test 1: The function exists with the expected signature
-- ---------------------------------------------------------------------
SELECT has_function(
  'public',
  'get_club_attendance_stats',
  ARRAY['uuid']::text[],
  'get_club_attendance_stats(UUID) should exist'
);

-- ---------------------------------------------------------------------
-- Test 2: The function returns JSON
-- ---------------------------------------------------------------------
SELECT function_returns(
  'public',
  'get_club_attendance_stats',
  ARRAY['uuid']::text[],
  'json',
  'get_club_attendance_stats should return json'
);

-- ---------------------------------------------------------------------
-- Test 3: event_count counts every event (including zero-RSVP events)
-- ---------------------------------------------------------------------
SELECT is(
  (get_club_attendance_stats('91000000-0000-0000-0000-000000000710')::jsonb ->> 'event_count')::bigint,
  5::bigint,
  'event_count reflects all 5 events'
);

-- ---------------------------------------------------------------------
-- Test 4: average is computed in Postgres: (7 + 3 + 2 + 3) / 4 = 3.75
-- ---------------------------------------------------------------------
SELECT is(
  (get_club_attendance_stats('91000000-0000-0000-0000-000000000710')::jsonb ->> 'average')::numeric,
  3.75::numeric,
  'average attendance = 3.75'
);

-- ---------------------------------------------------------------------
-- Test 5: median is computed via PERCENTILE_CONT(0.5): median of (2,3,3,7)
-- ---------------------------------------------------------------------
SELECT is(
  (get_club_attendance_stats('91000000-0000-0000-0000-000000000710')::jsonb ->> 'median')::numeric,
  3.00::numeric,
  'median attendance = 3.00'
);

-- ---------------------------------------------------------------------
-- Test 6: An empty club (no events) returns zeros instead of NULL
-- ---------------------------------------------------------------------
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('91000000-0000-0000-0000-000000000720', 'Empty Stats Club', 'empty-stats-club', 'Club with no events', '91000000-0000-0000-0000-000000000700')
ON CONFLICT (id) DO NOTHING;

SELECT is(
  get_club_attendance_stats('91000000-0000-0000-0000-000000000720')::jsonb = '{"club_id": "91000000-0000-0000-0000-000000000720", "event_count": 0, "average": 0.00, "median": 0.00}'::jsonb,
  true,
  'empty club returns zeros (event_count 0, average 0.00, median 0.00)'
);

-- ---------------------------------------------------------------------
-- Finish and clean up (ROLLBACK discards all inserted test data)
-- ---------------------------------------------------------------------
SELECT * FROM finish();
ROLLBACK;