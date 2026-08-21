-- =============================================================================
-- Test: trending_clubs_view.test.sql
-- Purpose: Verify materialized view creation, index existences, and refresh score ordering.
-- =============================================================================

BEGIN;

SELECT plan(4);

-- Test 1: Verify trending_clubs materialized view exists
SELECT has_table(
    'public',
    'trending_clubs',
    'Materialized view trending_clubs exists'
);

-- Test 2: Verify unique index exists
SELECT has_index(
    'public',
    'trending_clubs',
    'idx_trending_id',
    'Unique index idx_trending_id exists on trending_clubs view'
);

-- Setup mock data for verification
-- We create two clubs, one with more RSVPs in the last 7 days
INSERT INTO public.clubs (id, name, slug, description, member_count)
VALUES 
  ('c0000000-0000-0000-0000-000000000101', 'Trending Club A', 'trending-a', 'Popular club A', 10),
  ('c0000000-0000-0000-0000-000000000102', 'Laggard Club B', 'laggard-b', 'Less popular club B', 5);

INSERT INTO public.events (id, title, club_id, start_time, end_time, event_date)
VALUES
  ('e0000000-0000-0000-0000-000000000201', 'Event A1', 'c0000000-0000-0000-0000-000000000101', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days', NOW() + INTERVAL '1 day'),
  ('e0000000-0000-0000-0000-000000000202', 'Event B1', 'c0000000-0000-0000-0000-000000000102', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days', NOW() + INTERVAL '1 day');

-- Create RSVPs (Club A gets 2 RSVPs, Club B gets 1 RSVP)
INSERT INTO public.event_rsvps (id, event_id, user_id, rsvp_at)
VALUES
  ('r0000000-0000-0000-0000-000000000301', 'e0000000-0000-0000-0000-000000000201', (SELECT id FROM public.profiles LIMIT 1), NOW()),
  ('r0000000-0000-0000-0000-000000000302', 'e0000000-0000-0000-0000-000000000201', (SELECT id FROM public.profiles OFFSET 1 LIMIT 1), NOW()),
  ('r0000000-0000-0000-0000-000000000303', 'e0000000-0000-0000-0000-000000000202', (SELECT id FROM public.profiles LIMIT 1), NOW());

-- Test 3: Check stale cache (Materialized View is NOT auto-updated, should show 0 score for new clubs before refresh)
SELECT is(
    (SELECT score FROM public.trending_clubs WHERE id = 'c0000000-0000-0000-0000-000000000101'),
    NULL,
    'Stale view: new mock clubs are not yet in the cached materialized view'
);

-- Execute refresh to populate view
REFRESH MATERIALIZED VIEW public.trending_clubs;

-- Test 4: Verify correct scores and ordering after refresh
SELECT results_eq(
    'SELECT id, score FROM public.trending_clubs WHERE id IN (''c0000000-0000-0000-0000-000000000101'', ''c0000000-0000-0000-0000-000000000102'') ORDER BY score DESC',
    $$VALUES 
      ('c0000000-0000-0000-0000-000000000101'::uuid, 2::bigint),
      ('c0000000-0000-0000-0000-000000000102'::uuid, 1::bigint)$$,
    'Materialized view refreshed correctly and sorted by RSVP activity scores'
);

SELECT * FROM finish();
ROLLBACK;
