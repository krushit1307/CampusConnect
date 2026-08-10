-- ============================================================
-- Test Suite: merge_events.test.sql
-- Description: Verifies co-hosted event merging, association
--              re-parenting, duplicate deduplication and deletions.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (8 tests)
SELECT plan(8);

-- Test 1: Verify function exists
SELECT has_function(
  'public',
  'merge_events',
  ARRAY['uuid', 'uuid'],
  'Function public.merge_events(uuid, uuid) should exist'
);

-- Setup test data (users, clubs, events)
INSERT INTO auth.users (id, email, aud, role)
VALUES
  ('f0000000-0000-0000-0000-000000000001', 'user1@cc.edu', 'authenticated', 'authenticated'),
  ('f0000000-0000-0000-0000-000000000002', 'user2@cc.edu', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES
  ('f0000000-0000-0000-0000-000000000101', 'Club One', 'club-one', 'f0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000102', 'Club Two', 'club-two', 'f0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, location, created_by, event_date, status)
VALUES
  (
    'f0000000-0000-0000-0000-000000000201',
    'f0000000-0000-0000-0000-000000000101',
    'Primary Event',
    'Venue A',
    'f0000000-0000-0000-0000-000000000001',
    NOW() + INTERVAL '2 days',
    'published'
  ),
  (
    'f0000000-0000-0000-0000-000000000202',
    'f0000000-0000-0000-0000-000000000102',
    'Secondary Event',
    'Venue B',
    'f0000000-0000-0000-0000-000000000001',
    NOW() + INTERVAL '2 days',
    'published'
  )
ON CONFLICT (id) DO NOTHING;

-- Setup RSVPs
-- User 1 RSVPs to both Event 1 and Event 2 (duplicate scenario)
-- User 2 RSVPs to Event 2 only
INSERT INTO public.event_rsvps (id, event_id, user_id, club_id, status)
VALUES
  ('f0000000-0000-0000-0000-000000000301', 'f0000000-0000-0000-0000-000000000201', 'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000101', 'FREE'),
  ('f0000000-0000-0000-0000-000000000302', 'f0000000-0000-0000-0000-000000000202', 'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000102', 'FREE'),
  ('f0000000-0000-0000-0000-000000000303', 'f0000000-0000-0000-0000-000000000202', 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000102', 'FREE')
ON CONFLICT (id) DO NOTHING;

-- Setup Waitlist entries
-- User 2 joins waitlist for both (duplicate scenario)
INSERT INTO public.event_waitlist (id, event_id, user_id, club_id)
VALUES
  ('f0000000-0000-0000-0000-000000000401', 'f0000000-0000-0000-0000-000000000201', 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000101'),
  ('f0000000-0000-0000-0000-000000000402', 'f0000000-0000-0000-0000-000000000202', 'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000102')
ON CONFLICT (id) DO NOTHING;

-- Setup non-unique relations: Resources and Polls
INSERT INTO public.event_resources (id, event_id, title, url, resource_type)
VALUES ('f0000000-0000-0000-0000-000000000501', 'f0000000-0000-0000-0000-000000000202', 'Slides', 'https://cc.edu/slides.pdf', 'pdf')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.polls (id, event_id, created_by, question)
VALUES ('f0000000-0000-0000-0000-000000000601', 'f0000000-0000-0000-0000-000000000202', 'f0000000-0000-0000-0000-000000000001', 'Choose a Topic')
ON CONFLICT (id) DO NOTHING;

-- Perform the merge operation
SELECT public.merge_events('f0000000-0000-0000-0000-000000000201'::uuid, 'f0000000-0000-0000-0000-000000000202'::uuid);

-- Test 2: Verify secondary event is deleted
SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.events WHERE id = 'f0000000-0000-0000-0000-000000000202'::uuid),
  'Secondary event record should be deleted'
);

-- Test 3: Verify primary event still exists
SELECT ok(
  EXISTS (SELECT 1 FROM public.events WHERE id = 'f0000000-0000-0000-0000-000000000201'::uuid),
  'Primary event record should remain intact'
);

-- Test 4: Verify duplicate RSVPs are merged and deduplicated
SELECT is(
  (SELECT COUNT(*)::int FROM public.event_rsvps WHERE event_id = 'f0000000-0000-0000-0000-000000000201'::uuid),
  2,
  'RSVPs are merged and duplicate RSVPs are cleanly deduplicated (2 total)'
);

-- Test 5: Verify individual user RSVPs are preserved under primary event
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE event_id = 'f0000000-0000-0000-0000-000000000201'::uuid AND user_id = 'f0000000-0000-0000-0000-000000000001'::uuid
  ) AND EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE event_id = 'f0000000-0000-0000-0000-000000000201'::uuid AND user_id = 'f0000000-0000-0000-0000-000000000002'::uuid
  ),
  'Both users are correctly registered under primary event RSVPs'
);

-- Test 6: Verify waitlist entries are merged and deduplicated
SELECT is(
  (SELECT COUNT(*)::int FROM public.event_waitlist WHERE event_id = 'f0000000-0000-0000-0000-000000000201'::uuid),
  1,
  'Waitlist entry for User 2 is deduplicated (1 total)'
);

-- Test 7: Verify non-unique resources are re-parented
SELECT is(
  (SELECT event_id FROM public.event_resources WHERE id = 'f0000000-0000-0000-0000-000000000501'::uuid),
  'f0000000-0000-0000-0000-000000000201'::uuid,
  'Secondary event resource is correctly re-parented to primary event'
);

-- Test 8: Verify polls are re-parented
SELECT is(
  (SELECT event_id FROM public.polls WHERE id = 'f0000000-0000-0000-0000-000000000601'::uuid),
  'f0000000-0000-0000-0000-000000000201'::uuid,
  'Secondary event poll is correctly re-parented to primary event'
);

SELECT * FROM finish();
ROLLBACK;
