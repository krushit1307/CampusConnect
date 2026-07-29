-- ============================================================
-- Test Suite: get_user_attendance_rate.test.sql
-- Issue: #1180
-- Description: Verifies get_user_attendance_rate function calculation,
--              handling of future events, ongoing events, zero division
--              protection, 0% with RSVPs, and calculation accuracy.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (7 tests)
SELECT plan(7);

-- Test 1: Function get_user_attendance_rate exists
SELECT has_function(
  'public',
  'get_user_attendance_rate',
  ARRAY['uuid'],
  'Function get_user_attendance_rate(uuid) should exist in public schema'
);

-- Setup mock data
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'att_user0@test.com', 'authenticated', 'authenticated', '{"full_name": "No RSVPs User"}'),
  ('b0000000-0000-0000-0000-000000000002', 'att_user75@test.com', 'authenticated', 'authenticated', '{"full_name": "75 Percent User"}'),
  ('b0000000-0000-0000-0000-000000000003', 'att_user100@test.com', 'authenticated', 'authenticated', '{"full_name": "100 Percent User"}'),
  ('b0000000-0000-0000-0000-000000000004', 'att_host@test.com', 'authenticated', 'authenticated', '{"full_name": "Attendance Host"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('b0000000-0000-0000-0000-000000000005', 'Attendance Test Club', 'att-test-club', 'Club for attendance rate tests', 'b0000000-0000-0000-0000-000000000004');

-- Insert past & future events
INSERT INTO public.events (id, club_id, title, description, location, created_by, status, start_date, end_date)
VALUES
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000005', 'Past Event 1', 'Desc', 'Loc', 'b0000000-0000-0000-0000-000000000004', 'completed', NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days'),
  ('b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000005', 'Past Event 2', 'Desc', 'Loc', 'b0000000-0000-0000-0000-000000000004', 'completed', NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days'),
  ('b0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000005', 'Past Event 3', 'Desc', 'Loc', 'b0000000-0000-0000-0000-000000000004', 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
  ('b0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000005', 'Past Event 4', 'Desc', 'Loc', 'b0000000-0000-0000-0000-000000000004', 'completed', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
  ('b0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000005', 'Future Event 1', 'Desc', 'Loc', 'b0000000-0000-0000-0000-000000000004', 'scheduled', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days');

-- Insert RSVPs for user2 (att_user75): 4 past events, 3 checked in (75%), plus 1 future event (checked in)
INSERT INTO public.event_rsvps (event_id, user_id, checked_in) VALUES
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000002', TRUE),
  ('b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000002', TRUE),
  ('b0000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000002', TRUE),
  ('b0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000002', FALSE),
  ('b0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000002', TRUE);

-- Insert RSVPs for user3 (att_user100): 2 past events, 2 checked in (100%)
INSERT INTO public.event_rsvps (event_id, user_id, checked_in) VALUES
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000003', TRUE),
  ('b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000003', TRUE);

-- Test 2: User with 0 RSVPs returns 0
SELECT is(
  public.get_user_attendance_rate('b0000000-0000-0000-0000-000000000001'::uuid),
  0,
  'User with 0 past RSVPs returns 0'
);

-- Test 3: User with 3 checked in out of 4 past events returns 75 (ignoring future event)
SELECT is(
  public.get_user_attendance_rate('b0000000-0000-0000-0000-000000000002'::uuid),
  75,
  'User with 3 checked-in out of 4 past RSVPs returns 75 percentage'
);

-- Test 4: User with 2 checked in out of 2 past events returns 100
SELECT is(
  public.get_user_attendance_rate('b0000000-0000-0000-0000-000000000003'::uuid),
  100,
  'User with 2 checked-in out of 2 past RSVPs returns 100 percentage'
);

-- Test 5: User with only future RSVP returns 0 past attendance rate
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('b0000000-0000-0000-0000-000000000009', 'future_only@test.com', 'authenticated', 'authenticated', '{"full_name": "Future User"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_rsvps (event_id, user_id, checked_in)
VALUES ('b0000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000009', TRUE);

SELECT is(
  public.get_user_attendance_rate('b0000000-0000-0000-0000-000000000009'::uuid),
  0,
  'User with only future RSVPs returns 0 percentage'
);

-- Test 6: User with past RSVPs but 0 checked-in returns 0% (non-zero denominator)
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('b0000000-0000-0000-0000-000000000008', 'all_missed@test.com', 'authenticated', 'authenticated', '{"full_name": "All Missed User"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_rsvps (event_id, user_id, checked_in) VALUES
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000008', FALSE),
  ('b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000008', FALSE);

SELECT is(
  public.get_user_attendance_rate('b0000000-0000-0000-0000-000000000008'::uuid),
  0,
  'User with 2 past RSVPs and 0 checked-in returns 0 percentage'
);

-- Test 7: Ongoing event (start_date < NOW() and end_date > NOW()) is ignored as event has not ended yet
INSERT INTO public.events (id, club_id, title, description, location, created_by, status, start_date, end_date)
VALUES ('b0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000005', 'Ongoing Event 1', 'Desc', 'Loc', 'b0000000-0000-0000-0000-000000000004', 'scheduled', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '1 hour');

INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('b0000000-0000-0000-0000-000000000007', 'ongoing_user@test.com', 'authenticated', 'authenticated', '{"full_name": "Ongoing User"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_rsvps (event_id, user_id, checked_in) VALUES
  ('b0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000007', TRUE),
  ('b0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000007', FALSE);

SELECT is(
  public.get_user_attendance_rate('b0000000-0000-0000-0000-000000000007'::uuid),
  100,
  'Ongoing event is not counted as past ended event, so rate remains 100 percentage'
);

SELECT * FROM finish();
ROLLBACK;
