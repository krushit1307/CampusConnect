-- ============================================================
-- Test Suite: waitlist_auto_promote.test.sql
-- Issue: #587
-- Description: Verifies automatic waitlist promotion trigger on RSVP deletion
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (4 tests)
SELECT plan(4);

-- Test 1: Check function promote_waitlist_attendee exists
SELECT has_function(
  'public',
  'promote_waitlist_attendee',
  'Function promote_waitlist_attendee() should exist in public schema'
);

-- Setup mock data
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000081', 'rsvper@test.com', 'authenticated', 'authenticated', '{"full_name": "RSVP User"}'),
  ('90000000-0000-0000-0000-000000000082', 'waitlist1@test.com', 'authenticated', 'authenticated', '{"full_name": "Waitlist User 1"}'),
  ('90000000-0000-0000-0000-000000000083', 'waitlist2@test.com', 'authenticated', 'authenticated', '{"full_name": "Waitlist User 2"}'),
  ('90000000-0000-0000-0000-000000000084', 'organizer@test.com', 'authenticated', 'authenticated', '{"full_name": "Organizer"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000085', 'Waitlist Test Club', 'waitlist-test-club', 'Club for waitlist tests', '90000000-0000-0000-0000-000000000084');

INSERT INTO public.events (id, club_id, title, description, location, created_by, status, event_date)
VALUES (
  '90000000-0000-0000-0000-000000000086',
  '90000000-0000-0000-0000-000000000085',
  'Waitlist Capacity Event',
  'Event testing waitlist promotion',
  'Online',
  '90000000-0000-0000-0000-000000000084',
  'scheduled',
  NOW() + INTERVAL '5 days'
);

-- Insert active RSVP for User 1
INSERT INTO public.event_rsvps (id, event_id, user_id)
VALUES ('90000000-0000-0000-0000-000000000087', '90000000-0000-0000-0000-000000000086', '90000000-0000-0000-0000-000000000081');

-- Insert waitlist entry 1 (older entry)
INSERT INTO public.event_waitlist (id, event_id, user_id, created_at)
VALUES (
  '90000000-0000-0000-0000-000000000088',
  '90000000-0000-0000-0000-000000000086',
  '90000000-0000-0000-0000-000000000082',
  NOW() - INTERVAL '10 minutes'
);

-- Insert waitlist entry 2 (newer entry)
INSERT INTO public.event_waitlist (id, event_id, user_id, created_at)
VALUES (
  '90000000-0000-0000-0000-000000000089',
  '90000000-0000-0000-0000-000000000086',
  '90000000-0000-0000-0000-000000000083',
  NOW() - INTERVAL '5 minutes'
);

-- Cancel RSVP for User 1 (triggers promote_waitlist_attendee)
DELETE FROM public.event_rsvps WHERE id = '90000000-0000-0000-0000-000000000087';

-- Test 2: User 2 (oldest waitlisted entry) should be promoted to event_rsvps
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE event_id = '90000000-0000-0000-0000-000000000086'
      AND user_id = '90000000-0000-0000-0000-000000000082'
  ),
  'Oldest waitlisted user (User 2) is automatically promoted to event_rsvps'
);

-- Test 3: User 2 should be deleted from event_waitlist
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.event_waitlist
    WHERE id = '90000000-0000-0000-0000-000000000088'
  ),
  'Promoted user (User 2) is deleted from event_waitlist'
);

-- Test 4: User 3 (newer entry) remains on event_waitlist
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.event_waitlist
    WHERE id = '90000000-0000-0000-0000-000000000089'
  ),
  'Subsequent waitlisted user (User 3) remains on event_waitlist'
);

SELECT * FROM finish();
ROLLBACK;
