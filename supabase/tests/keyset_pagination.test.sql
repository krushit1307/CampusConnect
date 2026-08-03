-- ============================================================
-- Test Suite: keyset_pagination.test.sql
-- Description: Verifies indexes, get_posts_cursor, and
--              get_rsvps_cursor keyset pagination logic.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (7 tests)
SELECT plan(7);

-- Test 1 & 2: Verify compound indexes exist
SELECT has_index(
  'public',
  'posts',
  'idx_posts_created_at_id',
  'Compound index public.idx_posts_created_at_id should exist on public.posts'
);

SELECT has_index(
  'public',
  'event_rsvps',
  'idx_event_rsvps_rsvp_at_id',
  'Compound index public.idx_event_rsvps_rsvp_at_id should exist on public.event_rsvps'
);

-- Test 3: Verify get_posts_cursor function exists
SELECT has_function(
  'public',
  'get_posts_cursor',
  ARRAY['timestamp with time zone', 'uuid', 'integer'],
  'Function public.get_posts_cursor(timestamptz, uuid, integer) should exist'
);

-- Test 4: Verify get_rsvps_cursor function exists
SELECT has_function(
  'public',
  'get_rsvps_cursor',
  ARRAY['uuid', 'timestamp with time zone', 'uuid', 'integer'],
  'Function public.get_rsvps_cursor(uuid, timestamptz, uuid, integer) should exist'
);

-- Setup Mock Data
INSERT INTO auth.users (id, email, aud, role)
VALUES ('g0000000-0000-0000-0000-000000000001', 'author@cc.edu', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('g0000000-0000-0000-0000-000000000100', 'Paginated Club', 'paginated-club', 'g0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, location, created_by, event_date)
VALUES ('g0000000-0000-0000-0000-000000000200', 'g0000000-0000-0000-0000-000000000100', 'Paginated Event', 'Lobby', 'g0000000-0000-0000-0000-000000000001', NOW() + INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- Insert 3 posts with controlled timestamps (P1 > P2 > P3)
INSERT INTO public.posts (id, club_id, author_id, content, created_at)
VALUES
  ('g0000000-0000-0000-0000-000000000301', 'g0000000-0000-0000-0000-000000000100', 'g0000000-0000-0000-0000-000000000001', 'Post One', NOW() - INTERVAL '1 minute'),
  ('g0000000-0000-0000-0000-000000000302', 'g0000000-0000-0000-0000-000000000100', 'g0000000-0000-0000-0000-000000000001', 'Post Two', NOW() - INTERVAL '2 minutes'),
  ('g0000000-0000-0000-0000-000000000303', 'g0000000-0000-0000-0000-000000000100', 'g0000000-0000-0000-0000-000000000001', 'Post Three', NOW() - INTERVAL '3 minutes')
ON CONFLICT (id) DO NOTHING;

-- Insert 3 RSVPs with controlled timestamps (R1 > R2 > R3)
INSERT INTO public.event_rsvps (id, event_id, user_id, club_id, rsvp_at)
VALUES
  ('g0000000-0000-0000-0000-000000000401', 'g0000000-0000-0000-0000-000000000200', 'g0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000100', NOW() - INTERVAL '1 minute'),
  ('g0000000-0000-0000-0000-000000000402', 'g0000000-0000-0000-0000-000000000200', 'g0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000100', NOW() - INTERVAL '2 minutes'),
  ('g0000000-0000-0000-0000-000000000403', 'g0000000-0000-0000-0000-000000000200', 'g0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000100', NOW() - INTERVAL '3 minutes')
ON CONFLICT (id) DO NOTHING;

-- Test 5: Verify get_posts_cursor returns correct first page (P1, P2)
SELECT set_eq(
  'SELECT id FROM public.get_posts_cursor(NULL, NULL, 2)',
  ARRAY['g0000000-0000-0000-0000-000000000301'::uuid, 'g0000000-0000-0000-0000-000000000302'::uuid],
  'First page returns two most recent posts'
);

-- Test 6: Verify keyset cursor progression retrieves next page (P3)
SELECT set_eq(
  'SELECT id FROM public.get_posts_cursor((SELECT created_at FROM public.posts WHERE id = ''g0000000-0000-0000-0000-000000000302''), ''g0000000-0000-0000-0000-000000000302''::uuid, 2)',
  ARRAY['g0000000-0000-0000-0000-000000000303'::uuid],
  'Keyset cursor queries retrieve post records chronologically below cursor'
);

-- Test 7: Verify event RSVPs cursor pagination
SELECT set_eq(
  'SELECT id FROM public.get_rsvps_cursor(''g0000000-0000-0000-0000-000000000200''::uuid, NULL, NULL, 2)',
  ARRAY['g0000000-0000-0000-0000-000000000401'::uuid, 'g0000000-0000-0000-0000-000000000402'::uuid],
  'First page of RSVPs returns two most recent RSVP records for target event'
);

SELECT * FROM finish();
ROLLBACK;
