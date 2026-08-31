-- ============================================================
-- Test Suite: fraudulent_rsvp_quarantine.test.sql
-- Issue: #4252
-- Description: Verifies that 'quarantined' status is allowed on event_rsvps,
--              that it doesn't affect active event capacity, and
--              that quarantined RSVPs are ignored in count calculations.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(4);

-- Test 1: Verify event_rsvps check constraint allows 'quarantined' status
SELECT lives_ok(
  $$
  INSERT INTO auth.users (id, email, aud, role)
  VALUES ('b0000000-0000-0000-0000-000000000001', 'bot1@10minutemail.com', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clubs (id, name, slug, description, created_by)
  VALUES ('b0000000-0000-0000-0000-000000000005', 'Political Club', 'political-club', 'Club for bots', 'b0000000-0000-0000-0000-000000000001')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.events (id, club_id, title, description, location, created_by, status, event_date, max_attendees)
  VALUES (
    'b0000000-0000-0000-0000-000000000006',
    'b0000000-0000-0000-0000-000000000005',
    'Heated Debate',
    'High target event for bots',
    'Auditorium',
    'b0000000-0000-0000-0000-000000000001',
    'scheduled',
    NOW() + INTERVAL '1 day',
    1
  );

  INSERT INTO public.event_rsvps (event_id, user_id, status)
  VALUES ('b0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'quarantined');
  $$,
  'Check constraint allows inserting event_rsvps with status = quarantined'
);

-- Test 2: Verify that quarantined status does not count against venue capacity
-- We will insert a second user RSVP as 'attending' which should succeed since max_attendees = 1
-- and the quarantined user does not count towards the attending count.
SELECT lives_ok(
  $$
  INSERT INTO auth.users (id, email, aud, role)
  VALUES ('b0000000-0000-0000-0000-000000000002', 'legit@college.edu', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- The RPC join_event_or_waitlist should place legit user in 'attending' status because 'quarantined' is ignored.
  SELECT public.join_event_or_waitlist(
    'b0000000-0000-0000-0000-000000000006'::uuid,
    'b0000000-0000-0000-0000-000000000002'::uuid
  );
  $$,
  'Legit attendee succeeds to join as attending ignoring the quarantined bot'
);

-- Test 3: Check status of legit user is indeed 'attending'
SELECT results_eq(
  $$
  SELECT status FROM public.event_rsvps
  WHERE event_id = 'b0000000-0000-0000-0000-000000000006' AND user_id = 'b0000000-0000-0000-0000-000000000002'
  $$,
  $$
  VALUES ('attending'::text)
  $$,
  'Legit user has status attending'
);

-- Test 4: Verify that a third user gets waitlisted because capacity is occupied by the legit attendee (1/1)
SELECT results_eq(
  $$
  INSERT INTO auth.users (id, email, aud, role)
  VALUES ('b0000000-0000-0000-0000-000000000003', 'another@college.edu', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  SELECT (public.join_event_or_waitlist(
    'b0000000-0000-0000-0000-000000000006'::uuid,
    'b0000000-0000-0000-0000-000000000003'::uuid
  ) ->> 'status')::text;
  $$,
  $$
  VALUES ('waitlisted'::text)
  $$,
  'Third user gets waitlisted because max capacity is 1 and the quarantined bot did not count'
);

SELECT * FROM finish();
ROLLBACK;
