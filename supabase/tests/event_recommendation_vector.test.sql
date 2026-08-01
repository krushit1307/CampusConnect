-- ============================================================
-- Test Suite: event_recommendation_vector.test.sql
-- Description: Verifies pgvector extension setup, embedding column
--              attributes, and semantic cosine matching RPC.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (5 tests)
SELECT plan(5);

-- Test 1: Verify vector extension is enabled
SELECT has_extension('vector', 'pgvector extension should be enabled');

-- Test 2: Verify events table has embedding vector(384) column
SELECT col_type_is(
  'public',
  'events',
  'embedding',
  'public.vector(384)',
  'events.embedding column should be of type public.vector(384)'
);

-- Test 3: Verify recommend_events function exists
SELECT has_function(
  'public',
  'recommend_events',
  ARRAY['uuid', 'integer'],
  'Function public.recommend_events(uuid, integer) should exist'
);

-- Setup test data (users, club, events)
INSERT INTO auth.users (id, email, aud, role)
VALUES ('e0000000-0000-0000-0000-000000000001', 'organizer@cc.edu', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('e0000000-0000-0000-0000-000000000100', 'Vector Club', 'vector-club', 'e0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Insert three events with different 384-dimensional embeddings
-- E1 (AI Workshop) has embedding with 1.0 at index 1
-- E2 (ML Seminar - conceptually close to E1) has embedding with 0.9 at index 1, 0.1 at index 2
-- E3 (Cooking Class - conceptually far from E1) has embedding with 0.0 at index 1, 1.0 at index 384 (last element)
INSERT INTO public.events (id, club_id, title, location, created_by, event_date, status, embedding)
VALUES
  (
    'e0000000-0000-0000-0000-000000000201',
    'e0000000-0000-0000-0000-000000000100',
    'AI Workshop',
    'Room A',
    'e0000000-0000-0000-0000-000000000001',
    NOW() + INTERVAL '1 day',
    'published',
    array_prepend(1.0::float, array_fill(0.0::float, ARRAY[383]))::public.vector
  ),
  (
    'e0000000-0000-0000-0000-000000000202',
    'e0000000-0000-0000-0000-000000000100',
    'ML Seminar',
    'Room B',
    'e0000000-0000-0000-0000-000000000001',
    NOW() + INTERVAL '2 days',
    'published',
    array_prepend(0.9::float, array_prepend(0.1::float, array_fill(0.0::float, ARRAY[382])))::public.vector
  ),
  (
    'e0000000-0000-0000-0000-000000000203',
    'e0000000-0000-0000-0000-000000000100',
    'Cooking Class',
    'Kitchen',
    'e0000000-0000-0000-0000-000000000001',
    NOW() + INTERVAL '3 days',
    'published',
    array_append(array_fill(0.0::float, ARRAY[383]), 1.0::float)::public.vector
  )
ON CONFLICT (id) DO NOTHING;

-- Test 4: Query recommendations for E1 (AI Workshop) - E2 (ML Seminar) should be the first recommendation (similarity closest to 1.0)
SELECT is(
  (
    SELECT r.id::text FROM public.recommend_events('e0000000-0000-0000-0000-000000000201'::uuid, 2) r
    ORDER BY r.similarity DESC LIMIT 1
  ),
  'e0000000-0000-0000-0000-000000000202',
  'Conceptually similar event (ML Seminar) is recommended first'
);

-- Test 5: Verify that the query event itself (E1) is never recommended
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.recommend_events('e0000000-0000-0000-0000-000000000201'::uuid, 5) r
    WHERE r.id = 'e0000000-0000-0000-0000-000000000201'
  ),
  'Target event itself is excluded from recommendations list'
);

SELECT * FROM finish();
ROLLBACK;
