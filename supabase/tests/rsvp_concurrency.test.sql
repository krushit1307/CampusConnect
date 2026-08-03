-- ============================================================
-- Test Suite: rsvp_concurrency.test.sql
-- Issue: #1363
-- Description: Tests manage_event_rsvp RPC function with pessimistic
--              row locking (SELECT FOR UPDATE) and capacity enforcement.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (8 tests)
SELECT plan(8);

-- Grant schema privileges
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Test 1: Verify manage_event_rsvp function signature
SELECT has_function(
  'public',
  'manage_event_rsvp',
  ARRAY['uuid', 'uuid', 'text'],
  'Function public.manage_event_rsvp(uuid, uuid, text) should exist'
);

-- Setup test users
INSERT INTO auth.users (id, email, aud, role)
VALUES
  ('e1000000-0000-0000-0000-000000000001', 'rsvp_user1@test.com', 'authenticated', 'authenticated'),
  ('e1000000-0000-0000-0000-000000000002', 'rsvp_user2@test.com', 'authenticated', 'authenticated'),
  ('e1000000-0000-0000-0000-000000000003', 'rsvp_user3@test.com', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, handle)
VALUES
  ('e1000000-0000-0000-0000-000000000001', 'RSVP User 1', 'user1'),
  ('e1000000-0000-0000-0000-000000000002', 'RSVP User 2', 'user2'),
  ('e1000000-0000-0000-0000-000000000003', 'RSVP User 3', 'user3')
ON CONFLICT (id) DO NOTHING;

-- Insert test club
INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('e1000000-0000-0000-0000-000000000100', 'RSVP Test Club', 'rsvp-test-club', 'e1000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Insert test event with strict max_attendees = 2
INSERT INTO public.events (id, club_id, title, location, created_by, event_date, max_attendees, version)
VALUES ('e1000000-0000-0000-0000-000000000200', 'e1000000-0000-0000-0000-000000000100', 'Limited Capacity Concert', 'Main Quad', 'e1000000-0000-0000-0000-000000000001', NOW() + INTERVAL '3 days', 2, 1)
ON CONFLICT (id) DO NOTHING;

-- Test 2: User 1 RSVPs successfully
SELECT is(
  (public.manage_event_rsvp('e1000000-0000-0000-0000-000000000200', 'e1000000-0000-0000-0000-000000000001', 'RSVP')->>'code'),
  'RSVP_SUCCESS',
  'User 1 should successfully RSVP for available spot 1 of 2'
);

-- Test 3: User 1 tries duplicate RSVP -> ALREADY_RSVPED
SELECT is(
  (public.manage_event_rsvp('e1000000-0000-0000-0000-0000000000200', 'e1000000-0000-0000-0000-000000000001', 'RSVP')->>'code'),
  'ALREADY_RSVPED',
  'Duplicate RSVP from User 1 should return ALREADY_RSVPED'
);

-- Test 4: User 2 RSVPs successfully (2nd spot filled, max_attendees = 2)
SELECT is(
  (public.manage_event_rsvp('e1000000-0000-0000-0000-000000000200', 'e1000000-0000-0000-0000-000000000002', 'RSVP')->>'code'),
  'RSVP_SUCCESS',
  'User 2 should successfully RSVP for spot 2 of 2'
);

-- Test 5: User 3 tries to RSVP when event is at capacity (2/2 filled) -> EVENT_FULL
SELECT is(
  (public.manage_event_rsvp('e1000000-0000-0000-0000-000000000200', 'e1000000-0000-0000-0000-000000000003', 'RSVP')->>'code'),
  'EVENT_FULL',
  'User 3 RSVP attempt when 2/2 spots filled should return EVENT_FULL'
);

-- Test 6: Verify total count of RSVPs in table remains strictly 2 (51st/3rd RSVP blocked)
SELECT results_eq(
  'SELECT COUNT(*)::integer FROM public.event_rsvps WHERE event_id = ''e1000000-0000-0000-0000-000000000200''',
  ARRAY[2],
  'Total RSVP count in table must equal max_attendees capacity (2)'
);

-- Test 7: User 1 cancels RSVP -> spot is freed
SELECT is(
  (public.manage_event_rsvp('e1000000-0000-0000-0000-000000000200', 'e1000000-0000-0000-0000-000000000001', 'CANCEL')->>'code'),
  'CANCEL_SUCCESS',
  'User 1 RSVP cancellation should succeed and free a spot'
);

-- Test 8: User 3 can now RSVP into the newly freed spot
SELECT is(
  (public.manage_event_rsvp('e1000000-0000-0000-0000-000000000200', 'e1000000-0000-0000-0000-000000000003', 'RSVP')->>'code'),
  'RSVP_SUCCESS',
  'User 3 should successfully RSVP into the freed spot'
);

SELECT * FROM finish();
ROLLBACK;
