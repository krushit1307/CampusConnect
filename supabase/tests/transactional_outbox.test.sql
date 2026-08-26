-- ============================================================
-- Test Suite: transactional_outbox.test.sql
-- Description: Verifies table schema, trigger registration,
--              auto-enqueueing, and process_outbox_events behavior.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (5 tests)
SELECT plan(5);

-- Test 1: Verify outbox_events table exists
SELECT has_table('public', 'outbox_events', 'Table public.outbox_events should exist');

-- Test 2: Verify trigger trigger_posts_outbox is attached to posts
SELECT has_trigger(
  'public',
  'posts',
  'trigger_posts_outbox',
  'Trigger trigger_posts_outbox should be attached to posts table'
);

-- Setup Mock Data (users, club)
INSERT INTO auth.users (id, email, aud, role)
VALUES ('i0000000-0000-0000-0000-000000000001', 'author@cc.edu', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('i0000000-0000-0000-0000-000000000100', 'Outbox Club', 'outbox-club', 'i0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Test 3: Insert a post (should fire AFTER INSERT trigger and enqueue to outbox)
INSERT INTO public.posts (id, club_id, author_id, content)
VALUES ('i0000000-0000-0000-0000-000000000301', 'i0000000-0000-0000-0000-000000000100', 'i0000000-0000-0000-0000-000000000001', 'Hello Outbox!');

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.outbox_events
    WHERE payload->>'table' = 'posts'
      AND payload->>'action' = 'INSERT'
      AND payload->'record'->>'id' = 'i0000000-0000-0000-0000-000000000301'
      AND status = 'pending'
  ),
  'Inserting a post successfully triggers transactional outbox auto-enqueueing (status is pending)'
);

-- Test 4: Verify process_outbox_events updates queue items to processed
SELECT public.process_outbox_events();

SELECT is(
  (SELECT status FROM public.outbox_events WHERE payload->'record'->>'id' = 'i0000000-0000-0000-0000-000000000301'),
  'processed',
  'Running process_outbox_events shifts pending queue rows to processed'
);

-- Test 5: Verify processed_at timestamp is populated
SELECT ok(
  (SELECT processed_at FROM public.outbox_events WHERE payload->'record'->>'id' = 'i0000000-0000-0000-0000-000000000301') IS NOT NULL,
  'Outbox event processed_at timestamp is correctly populated'
);

SELECT * FROM finish();
ROLLBACK;
