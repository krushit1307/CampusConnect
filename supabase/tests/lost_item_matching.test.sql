-- ============================================================
-- Test Suite: lost_item_matching.test.sql
-- Description: Verifies the Post-Event Lost Item Matching Algorithm trigger and scoring heuristics.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(9);

-- 1. Verify schema elements exist on lost_items
SELECT has_column('public', 'lost_items', 'type', 'lost_items should have type column');
SELECT has_column('public', 'lost_items', 'event_id', 'lost_items should have event_id column');
SELECT has_column('public', 'lost_items', 'lat', 'lost_items should have lat column');
SELECT has_column('public', 'lost_items', 'lng', 'lost_items should have lng column');

-- 2. Verify lost_items has coordinate index
SELECT has_index(
    'public',
    'lost_items',
    'idx_lost_items_coords',
    'lost_items should have coordinate index idx_lost_items_coords'
);

-- 3. Verify lost_item_matches table exists
SELECT has_table('public', 'lost_item_matches', 'lost_item_matches table should exist');

-- 4. Setup mock users, profiles, and event
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-0000000000a1', 'owner@campus.edu'),
    ('00000000-0000-0000-0000-0000000000a2', 'finder@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-0000000000a1', 'Item Owner', 'item_owner', 'owner@campus.edu'),
    ('00000000-0000-0000-0000-0000000000a2', 'Item Finder', 'item_finder', 'finder@campus.edu')
ON CONFLICT (id) DO NOTHING;

-- Mock club and event
INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('00000000-0000-0000-0000-0000000000c1', 'Test Club', 'test-club', '00000000-0000-0000-0000-0000000000a1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, title, description, location, created_by, club_id, status)
VALUES (
    '00000000-0000-0000-0000-0000000000e1',
    'Test Gala',
    'Annual Test Gala Event',
    'Grand Hall',
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000c1',
    'published'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Test Trigger Matching on High Similarity (Same Event, High Tag Intersection, Same Day)
-- Owner inserts Lost AirPods
INSERT INTO public.lost_items (id, user_id, title, description, category, type, event_id, search_tags, status, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-0000000000a1',
    'Lost AirPods Pro',
    'My white Apple AirPods Pro got lost at the Gala.',
    'Electronics',
    'lost',
    '00000000-0000-0000-0000-0000000000e1',
    '["airpods", "apple", "white"]'::jsonb,
    'unclaimed',
    NOW()
);

-- Finder inserts Found AirPods
INSERT INTO public.lost_items (id, user_id, title, description, category, type, event_id, search_tags, status, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-0000000000a2',
    'Found AirPods Pro',
    'Found white AirPods inside a case.',
    'Electronics',
    'found',
    '00000000-0000-0000-0000-0000000000e1',
    '["airpods", "apple", "white"]'::jsonb,
    'unclaimed',
    NOW()
);

-- Verify that a match record is automatically generated
SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.lost_item_matches
    WHERE lost_item_id = '00000000-0000-0000-0000-000000000001'
      AND found_item_id = '00000000-0000-0000-0000-000000000002';
    $$,
    ARRAY[1],
    'A high-probability match should be automatically inserted into lost_item_matches table'
);

-- 6. Verify transactional outbox event is enqueued for matching notification
SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.outbox_events
    WHERE payload->>'table' = 'lost_item_matches'
      AND payload->>'action' = 'INSERT'
      AND (payload->'record'->>'lost_item_id') = '00000000-0000-0000-0000-000000000001';
    $$,
    ARRAY[1],
    'An outbox notification event should be enqueued in the outbox_events table'
);

-- 7. Test Generic Item / False Positive avoidance (Tag overlap is identical, but different events/locations/dates)
-- Owner inserts Lost Black iPhone
INSERT INTO public.lost_items (id, user_id, title, description, category, type, search_tags, status, created_at, lat, lng)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-0000000000a1',
    'Lost Black iPhone 15',
    'Dropped my black iPhone 15 somewhere.',
    'Electronics',
    'lost',
    '["iphone", "black", "apple"]'::jsonb,
    'unclaimed',
    NOW() - INTERVAL '10 days',
    40.7128,
    -74.0060
);

-- Finder inserts Found Black iPhone at a completely different campus location
INSERT INTO public.lost_items (id, user_id, title, description, category, type, search_tags, status, created_at, lat, lng)
VALUES (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-0000000000a2',
    'Found Black iPhone',
    'Picked up a black phone.',
    'Electronics',
    'found',
    '["iphone", "black", "apple"]'::jsonb,
    'unclaimed',
    NOW(),
    40.7500,  -- completely different location (> 4km away)
    -74.0000
);

-- Expect score to be below 75 threshold, hence NO match created
SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.lost_item_matches
    WHERE lost_item_id = '00000000-0000-0000-0000-000000000003'
      AND found_item_id = '00000000-0000-0000-0000-000000000004';
    $$,
    ARRAY[0],
    'Different spatial location and temporal gap should prevent generic items from triggering false positive matches'
);

ROLLBACK;
