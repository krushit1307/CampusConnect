-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 4 tests)
SELECT plan(4);

-- 1. Setup mock data
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('90000000-0000-0000-0000-000000000001', 'organizer@test.com', 'authenticated', 'authenticated', '{"full_name": "Organizer"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000002', 'Test Club Overlap', 'test-club-overlap', 'Club for overlap test', '90000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Test 1: Insert first event successfully
SELECT lives_ok(
  $$
  INSERT INTO public.events (id, club_id, title, location, start_date, end_date, created_by)
  VALUES (
    '90000000-0000-0000-0000-000000000003',
    '90000000-0000-0000-0000-000000000002',
    'Event A',
    'Auditorium',
    '2026-08-01 10:00:00+00',
    '2026-08-01 12:00:00+00',
    '90000000-0000-0000-0000-000000000001'
  );
  $$,
  'First event at a location and time should insert successfully'
);

-- Test 2: Insert overlapping event at same location fails
SELECT throws_ok(
  $$
  INSERT INTO public.events (id, club_id, title, location, start_date, end_date, created_by)
  VALUES (
    '90000000-0000-0000-0000-000000000004',
    '90000000-0000-0000-0000-000000000002',
    'Event B (Overlapping)',
    'Auditorium',
    '2026-08-01 11:00:00+00',
    '2026-08-01 13:00:00+00',
    '90000000-0000-0000-0000-000000000001'
  );
  $$,
  'An event is already scheduled at this location during the selected time range.',
  'Overlapping event insert should throw exception'
);

-- Test 3: Insert non-overlapping event at same location (adjacent time) works
SELECT lives_ok(
  $$
  INSERT INTO public.events (id, club_id, title, location, start_date, end_date, created_by)
  VALUES (
    '90000000-0000-0000-0000-000000000005',
    '90000000-0000-0000-0000-000000000002',
    'Event C (Non-overlapping)',
    'Auditorium',
    '2026-08-01 12:00:00+00',
    '2026-08-01 14:00:00+00',
    '90000000-0000-0000-0000-000000000001'
  );
  $$,
  'Non-overlapping adjacent event should insert successfully'
);

-- Test 4: Updating a non-time field of Event A should work without conflict
SELECT lives_ok(
  $$
  UPDATE public.events
  SET title = 'Event A Updated'
  WHERE id = '90000000-0000-0000-0000-000000000003';
  $$,
  'Updating non-time fields of existing event should work without conflict error'
);

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
