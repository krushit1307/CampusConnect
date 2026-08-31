-- ============================================================
-- Test Suite: event_cancellation_cascade.test.sql
-- Issue: #4664
-- Description: Verifies event cancellation safely cascades to dependencies
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(6);

-- 1. Setup mock data
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'cascade_org@test.com', 'authenticated', 'authenticated', '{"full_name": "Org"}'),
  ('c0000000-0000-0000-0000-000000000002', 'cascade_rsvp@test.com', 'authenticated', 'authenticated', '{"full_name": "RSVP"}'),
  ('c0000000-0000-0000-0000-000000000003', 'cascade_wait1@test.com', 'authenticated', 'authenticated', '{"full_name": "Wait1"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Org'),
  ('c0000000-0000-0000-0000-000000000002', 'RSVP'),
  ('c0000000-0000-0000-0000-000000000003', 'Wait1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, owner_id)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Cascade Club', 'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Create an event
INSERT INTO public.events (id, club_id, title, description, start_time, end_time, location, max_attendees, available_spots, status)
VALUES (
  'e2000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'Cascade Test Event',
  'Desc',
  NOW() + INTERVAL '1 day',
  NOW() + INTERVAL '2 days',
  'Room A',
  1,
  0,
  'published'
) ON CONFLICT (id) DO NOTHING;

-- Insert an RSVP (fills the event)
INSERT INTO public.event_rsvps (event_id, user_id, status)
VALUES ('e2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'approved')
ON CONFLICT DO NOTHING;

-- Insert a waitlist entry (since event is full)
INSERT INTO public.event_waitlist (event_id, user_id)
VALUES ('e2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- Insert a mock certificate
INSERT INTO public.certificates (id, event_id, user_id, certificate_url)
VALUES ('f3000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'https://mock.com/cert.pdf')
ON CONFLICT DO NOTHING;

-- Insert a mock feedback
INSERT INTO public.event_feedbacks (id, event_id, user_id, rating, comment)
VALUES ('f4000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 5, 'Great!')
ON CONFLICT DO NOTHING;

-- Cancel the event
UPDATE public.events SET status = 'cancelled' WHERE id = 'e2000000-0000-0000-0000-000000000001';

-- 2. Tests

-- Test 1: Notification was sent to the RSVP user
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.notifications 
    WHERE user_id = 'c0000000-0000-0000-0000-000000000002' 
      AND type = 'event' 
      AND title = 'Event Canceled'
  ),
  'Notification should be created for RSVP user before RSVPs are deleted'
);

-- Test 2: Notification was NOT sent to waitlist user (because waitlist users don't get RSVP notifications by default)
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.notifications 
    WHERE user_id = 'c0000000-0000-0000-0000-000000000003' 
      AND title = 'Event Canceled'
  ),
  'Notification should not be created for waitlist user'
);

-- Test 3: Event waitlist should be cleared
SELECT is(
  (SELECT COUNT(*)::INT FROM public.event_waitlist WHERE event_id = 'e2000000-0000-0000-0000-000000000001'),
  0,
  'Waitlist should be completely cleared upon cancellation'
);

-- Test 4: Event RSVPs should be cleared (cascaded)
SELECT is(
  (SELECT COUNT(*)::INT FROM public.event_rsvps WHERE event_id = 'e2000000-0000-0000-0000-000000000001'),
  0,
  'RSVPs should be deleted upon cancellation'
);

-- Test 5: Certificates should be cleared
SELECT is(
  (SELECT COUNT(*)::INT FROM public.certificates WHERE event_id = 'e2000000-0000-0000-0000-000000000001'),
  0,
  'Certificates should be deleted upon cancellation'
);

-- Test 6: Feedbacks should be cleared
SELECT is(
  (SELECT COUNT(*)::INT FROM public.event_feedbacks WHERE event_id = 'e2000000-0000-0000-0000-000000000001'),
  0,
  'Event feedbacks should be deleted upon cancellation'
);

SELECT * FROM finish();
ROLLBACK;
