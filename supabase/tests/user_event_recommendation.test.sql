-- ============================================================
-- Test Suite: user_event_recommendation.test.sql
-- Description: Verifies profiles interest vector column, trigger
--              updates on RSVPs, and user interest matching RPC.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (4 tests)
SELECT plan(4);

-- Test 1: Verify profiles table has interest_vector public.vector(384) column
SELECT col_type_is(
  'public',
  'profiles',
  'interest_vector',
  'public.vector(384)',
  'profiles.interest_vector column should be of type public.vector(384)'
);

-- Test 2: Verify recommend_events_for_user function exists
SELECT has_function(
  'public',
  'recommend_events_for_user',
  ARRAY['uuid', 'integer'],
  'Function public.recommend_events_for_user(uuid, integer) should exist'
);

-- Setup test data (users, club, events)
INSERT INTO auth.users (id, email, aud, role)
VALUES ('e0000000-0000-0000-0000-000000000002', 'voter@cc.edu', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, handle)
VALUES ('e0000000-0000-0000-0000-000000000002', 'Voter Student', 'voterstudent')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('e0000000-0000-0000-0000-000000000101', 'Embed Club', 'embed-club', 'e0000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Insert three future events
INSERT INTO public.events (id, club_id, title, location, created_by, event_date, status, embedding)
VALUES
  (
    'e0000000-0000-0000-0000-000000000301',
    'e0000000-0000-0000-0000-000000000101',
    'Robotics Lab Intro',
    'Lab A',
    'e0000000-0000-0000-0000-000000000002',
    NOW() + INTERVAL '5 days',
    'published',
    array_prepend(1.0::float, array_fill(0.0::float, ARRAY[383]))::public.vector
  ),
  (
    'e0000000-0000-0000-0000-000000000302',
    'e0000000-0000-0000-0000-000000000101',
    'Computer Vision Seminar',
    'Hall B',
    'e0000000-0000-0000-0000-000000000002',
    NOW() + INTERVAL '6 days',
    'published',
    array_prepend(0.8::float, array_prepend(0.2::float, array_fill(0.0::float, ARRAY[382])))::public.vector
  ),
  (
    'e0000000-0000-0000-0000-000000000303',
    'e0000000-0000-0000-0000-000000000101',
    'Gardening Gathering',
    'Greenhouse',
    'e0000000-0000-0000-0000-000000000002',
    NOW() + INTERVAL '7 days',
    'published',
    array_append(array_fill(0.0::float, ARRAY[383]), 1.0::float)::public.vector
  )
ON CONFLICT (id) DO NOTHING;

-- Test 3: Cold-start returns future events sorted by date
SELECT ok(
  (
    SELECT COUNT(*)::int FROM public.recommend_events_for_user('e0000000-0000-0000-0000-000000000002'::uuid, 3)
  ) = 3,
  'Cold start returns all future events even without RSVP profile vector'
);

-- User RSVPs to Robotics Lab Intro
INSERT INTO public.event_rsvps (event_id, user_id, status)
VALUES ('e0000000-0000-0000-0000-000000000301', 'e0000000-0000-0000-0000-000000000002', 'attending')
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Test 4: Profile interest vector updates and triggers proper recommendation matching
-- Since they RSVP'd to Robotics (1.0 at index 1), their interest vector should be close to it
-- So Computer Vision (0.8 at index 1) should match closer than Gardening (0.0 at index 1)
SELECT is(
  (
    SELECT r.id::text FROM public.recommend_events_for_user('e0000000-0000-0000-0000-000000000002'::uuid, 2) r
    WHERE r.id <> 'e0000000-0000-0000-0000-000000000301'
    ORDER BY r.similarity DESC LIMIT 1
  ),
  'e0000000-0000-0000-0000-000000000302',
  'Conceptually similar event (Computer Vision Seminar) is recommended based on RSVP history'
);

ROLLBACK;
