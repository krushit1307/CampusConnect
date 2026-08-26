-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(6);

-- Setup mock data
-- Create a test user in auth.users
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000801', 'doublebooker@test.com', 'authenticated', 'authenticated', '{"full_name": "Double Booker"}')
ON CONFLICT (id) DO NOTHING;

-- Create a club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000802', 'Double Booking Club', 'double-booking-club', 'A club for testing overlaps', '90000000-0000-0000-0000-000000000801')
ON CONFLICT (id) DO NOTHING;

-- Generate test venue IDs
-- Venue 1: '90000000-0000-0000-0000-000000000803'
-- Venue 2: '90000000-0000-0000-0000-000000000804'


-- ==========================================
-- Test Case 1: Inserting first event succeeds
-- ==========================================
SELECT lives_ok(
  $$INSERT INTO public.events (id, club_id, title, venue_id, start_date, end_date, created_by)
    VALUES (
      '90000000-0000-0000-0000-000000000805',
      '90000000-0000-0000-0000-000000000802',
      'Event 1',
      '90000000-0000-0000-0000-000000000803',
      '2026-08-01 10:00:00+00'::TIMESTAMPTZ,
      '2026-08-01 12:00:00+00'::TIMESTAMPTZ,
      '90000000-0000-0000-0000-000000000801'
    )$$,
  'Should successfully insert first event for Venue 1'
);

-- ==========================================
-- Test Case 2: Inserting overlapping event for SAME venue fails
-- ==========================================
SELECT throws_ok(
  $$INSERT INTO public.events (id, club_id, title, venue_id, start_date, end_date, created_by)
    VALUES (
      '90000000-0000-0000-0000-000000000806',
      '90000000-0000-0000-0000-000000000802',
      'Event 2 (Overlapping)',
      '90000000-0000-0000-0000-000000000803',
      '2026-08-01 11:00:00+00'::TIMESTAMPTZ,
      '2026-08-01 13:00:00+00'::TIMESTAMPTZ,
      '90000000-0000-0000-0000-000000000801'
    )$$,
  'A double-booking has been detected for venue_id: 90000000-0000-0000-0000-000000000803 at this time.',
  'Should reject overlapping event at the same venue'
);

-- ==========================================
-- Test Case 3: Inserting overlapping event for DIFFERENT venue succeeds
-- ==========================================
SELECT lives_ok(
  $$INSERT INTO public.events (id, club_id, title, venue_id, start_date, end_date, created_by)
    VALUES (
      '90000000-0000-0000-0000-000000000807',
      '90000000-0000-0000-0000-000000000802',
      'Event 3 (Different Venue)',
      '90000000-0000-0000-0000-000000000804',
      '2026-08-01 11:00:00+00'::TIMESTAMPTZ,
      '2026-08-01 13:00:00+00'::TIMESTAMPTZ,
      '90000000-0000-0000-0000-000000000801'
    )$$,
  'Should allow overlapping event at a different venue'
);

-- ==========================================
-- Test Case 4: Inserting non-overlapping event for SAME venue succeeds
-- ==========================================
SELECT lives_ok(
  $$INSERT INTO public.events (id, club_id, title, venue_id, start_date, end_date, created_by)
    VALUES (
      '90000000-0000-0000-0000-000000000808',
      '90000000-0000-0000-0000-000000000802',
      'Event 4 (Sequential)',
      '90000000-0000-0000-0000-000000000803',
      '2026-08-01 12:00:00+00'::TIMESTAMPTZ,
      '2026-08-01 14:00:00+00'::TIMESTAMPTZ,
      '90000000-0000-0000-0000-000000000801'
    )$$,
  'Should allow sequential, non-overlapping event at same venue'
);

-- ==========================================
-- Test Case 5: Updating event itself without time change succeeds
-- ==========================================
SELECT lives_ok(
  $$UPDATE public.events 
    SET title = 'Event 1 Renamed'
    WHERE id = '90000000-0000-0000-0000-000000000805'$$,
  'Should allow updating details of an event without time change'
);

-- ==========================================
-- Test Case 6: Updating event to conflict with another event fails
-- ==========================================
SELECT throws_ok(
  $$UPDATE public.events 
    SET start_date = '2026-08-01 11:30:00+00'::TIMESTAMPTZ,
        end_date = '2026-08-01 13:30:00+00'::TIMESTAMPTZ
    WHERE id = '90000000-0000-0000-0000-000000000805'$$,
  'A double-booking has been detected for venue_id: 90000000-0000-0000-0000-000000000803 at this time.',
  'Should reject updates that create a double-booking'
);

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
