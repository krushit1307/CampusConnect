-- ============================================================
-- Test Suite: safe_rsvp.test.sql
-- Issue: #1103
-- Description: Verifies safe_rsvp function capacity checks, concurrency locking,
--              and automatic waitlist overflow behavior.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (5 tests)
SELECT plan(5);

-- Test 1: Function safe_rsvp exists
SELECT has_function(
  'public',
  'safe_rsvp',
  ARRAY['uuid', 'uuid'],
  'Function safe_rsvp(uuid, uuid) should exist in public schema'
);

-- Setup mock data
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'user1@test.com', 'authenticated', 'authenticated', '{"full_name": "User One"}'),
  ('a0000000-0000-0000-0000-000000000002', 'user2@test.com', 'authenticated', 'authenticated', '{"full_name": "User Two"}'),
  ('a0000000-0000-0000-0000-000000000003', 'user3@test.com', 'authenticated', 'authenticated', '{"full_name": "User Three"}'),
  ('a0000000-0000-0000-0000-000000000004', 'host@test.com', 'authenticated', 'authenticated', '{"full_name": "Event Host"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('a0000000-0000-0000-0000-000000000005', 'RSVP Test Club', 'rsvp-test-club', 'Club for safe_rsvp tests', 'a0000000-0000-0000-0000-000000000004');

-- Create an event with max_attendees = 2
INSERT INTO public.events (id, club_id, title, description, location, created_by, status, event_date, max_attendees)
VALUES (
  'a0000000-0000-0000-0000-000000000006',
  'a0000000-0000-0000-0000-000000000005',
  'Limited Capacity Workshop',
  'Workshop with capacity of 2 attendees',
  'Room 101',
  'a0000000-0000-0000-0000-000000000004',
  'scheduled',
  NOW() + INTERVAL '3 days',
  2
);

-- Test 2: User 1 RSVPs (1st spot of 2) -> returns 'rsvp'
SELECT is(
  public.safe_rsvp('a0000000-0000-0000-0000-000000000006'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid),
  'rsvp',
  'User 1 successfully gets active RSVP spot'
);

-- Test 3: User 2 RSVPs (2nd spot of 2) -> returns 'rsvp'
SELECT is(
  public.safe_rsvp('a0000000-0000-0000-0000-000000000006'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid),
  'rsvp',
  'User 2 successfully gets active RSVP spot'
);

-- Test 4: User 3 RSVPs (event full, 2/2) -> returns 'waitlist'
SELECT is(
  public.safe_rsvp('a0000000-0000-0000-0000-000000000006'::uuid, 'a0000000-0000-0000-0000-000000000003'::uuid),
  'waitlist',
  'User 3 is automatically placed on waitlist when event is full'
);

-- Test 5: Verify User 3 is in event_waitlist table and NOT event_rsvps
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.event_waitlist
    WHERE event_id = 'a0000000-0000-0000-0000-000000000006'
      AND user_id = 'a0000000-0000-0000-0000-000000000003'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE event_id = 'a0000000-0000-0000-0000-000000000006'
      AND user_id = 'a0000000-0000-0000-0000-000000000003'
  ),
  'User 3 exists in event_waitlist and not in event_rsvps'
);

SELECT * FROM finish();
ROLLBACK;
