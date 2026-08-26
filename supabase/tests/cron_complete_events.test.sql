-- ============================================================
-- Test Suite: cron_complete_events.test.sql
-- Issue: #589
-- Description: Verifies public.auto_complete_past_events() function
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (4 tests)
SELECT plan(4);

-- Test 1: Check function auto_complete_past_events exists
SELECT has_function(
  'public',
  'auto_complete_past_events',
  'Function auto_complete_past_events() should exist in public schema'
);

-- Setup mock data
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000099', 'cron_test_owner@test.com', 'authenticated', 'authenticated', '{"full_name": "Cron Owner"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000098', 'Cron Test Club', 'cron-test-club', 'Club for testing cron job', '90000000-0000-0000-0000-000000000099');

-- Insert test events
-- 1. Past scheduled event (event_date has passed)
INSERT INTO public.events (id, club_id, title, description, location, created_by, status, event_date)
VALUES (
  '90000000-0000-0000-0000-000000000091',
  '90000000-0000-0000-0000-000000000098',
  'Past Scheduled Event',
  'Event date in past',
  'Online',
  '90000000-0000-0000-0000-000000000099',
  'scheduled',
  NOW() - INTERVAL '2 days'
);

-- 2. Future scheduled event (event_date in future)
INSERT INTO public.events (id, club_id, title, description, location, created_by, status, event_date)
VALUES (
  '90000000-0000-0000-0000-000000000092',
  '90000000-0000-0000-0000-000000000098',
  'Future Scheduled Event',
  'Event date in future',
  'Online',
  '90000000-0000-0000-0000-000000000099',
  'scheduled',
  NOW() + INTERVAL '2 days'
);

-- 3. Past canceled event (canceled status should not change)
INSERT INTO public.events (id, club_id, title, description, location, created_by, status, event_date)
VALUES (
  '90000000-0000-0000-0000-000000000093',
  '90000000-0000-0000-0000-000000000098',
  'Past Canceled Event',
  'Canceled event in past',
  'Online',
  '90000000-0000-0000-0000-000000000099',
  'canceled',
  NOW() - INTERVAL '2 days'
);

-- Execute auto_complete_past_events()
SELECT public.auto_complete_past_events();

-- Test 2: Past scheduled event should be updated to 'completed'
SELECT is(
  (SELECT status FROM public.events WHERE id = '90000000-0000-0000-0000-000000000091'),
  'completed',
  'Past scheduled event status is updated to completed'
);

-- Test 3: Future scheduled event should remain 'scheduled'
SELECT is(
  (SELECT status FROM public.events WHERE id = '90000000-0000-0000-0000-000000000092'),
  'scheduled',
  'Future scheduled event status remains scheduled'
);

-- Test 4: Past canceled event should remain 'canceled'
SELECT is(
  (SELECT status FROM public.events WHERE id = '90000000-0000-0000-0000-000000000093'),
  'canceled',
  'Past canceled event status remains canceled'
);

SELECT * FROM finish();
ROLLBACK;
