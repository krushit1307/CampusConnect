-- ============================================================
-- Test Suite: secure_checkout.test.sql
-- Description: Verifies transaction advisory locking checkout,
--              duplicate prevention, and capacity enforcement.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (5 tests)
SELECT plan(5);

-- Test 1: Verify checkout function exists
SELECT has_function(
  'public',
  'secure_event_checkout',
  ARRAY['uuid', 'uuid'],
  'Function public.secure_event_checkout(uuid, uuid) should exist'
);

-- Setup mock data (users, club, event with max_attendees = 2)
INSERT INTO auth.users (id, email, aud, role)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'user1@cc.edu', 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-000000000002', 'user2@cc.edu', 'authenticated', 'authenticated'),
  ('d0000000-0000-0000-0000-000000000003', 'user3@cc.edu', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('d0000000-0000-0000-0000-000000000100', 'Locking Club', 'locking-club', 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Event capacity = 2 attendees
INSERT INTO public.events (id, club_id, title, location, created_by, event_date, max_attendees)
VALUES ('d0000000-0000-0000-0000-000000000200', 'd0000000-0000-0000-0000-000000000100', 'Checkout Event', 'Locker Room', 'd0000000-0000-0000-0000-000000000001', NOW() + INTERVAL '5 days', 2)
ON CONFLICT (id) DO NOTHING;

-- Test 2: First check-out should return SUCCESS
SELECT is(
  public.secure_event_checkout('d0000000-0000-0000-0000-000000000200'::uuid, 'd0000000-0000-0000-0000-000000000001'::uuid),
  'SUCCESS',
  'First user checks out successfully'
);

-- Test 3: Re-checking out should return ALREADY_RSVPED
SELECT is(
  public.secure_event_checkout('d0000000-0000-0000-0000-000000000200'::uuid, 'd0000000-0000-0000-0000-000000000001'::uuid),
  'ALREADY_RSVPED',
  'Duplicate checkout attempt returns ALREADY_RSVPED'
);

-- Test 4: Second checkout should return SUCCESS (reaches capacity limit of 2)
SELECT is(
  public.secure_event_checkout('d0000000-0000-0000-0000-000000000200'::uuid, 'd0000000-0000-0000-0000-000000000002'::uuid),
  'SUCCESS',
  'Second user checks out successfully'
);

-- Test 5: Third checkout attempt should return FULL (blocking overselling)
SELECT is(
  public.secure_event_checkout('d0000000-0000-0000-0000-000000000200'::uuid, 'd0000000-0000-0000-0000-000000000003'::uuid),
  'FULL',
  'Third user checkout is blocked with status FULL (capacity reached)'
);

SELECT * FROM finish();
ROLLBACK;
