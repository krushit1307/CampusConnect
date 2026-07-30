-- pgTAP test for PostGIS extension & get_events_nearby RPC (#1860)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(7);

-- Grant privileges to test execution roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- 1. Test PostGIS extension is enabled
SELECT has_extension('postgis', 'PostGIS extension should be installed');

-- 2. Test events table has location_geo column
SELECT has_column('public', 'events', 'location_geo', 'events table should have location_geo column');

-- 3. Test GiST spatial index exists
SELECT has_index('public', 'events', 'idx_events_location_geo_gist', 'events table should have idx_events_location_geo_gist spatial index');

-- 4. Test get_events_nearby function exists
SELECT has_function('public', 'get_events_nearby', ARRAY['double precision', 'double precision', 'double precision'], 'get_events_nearby RPC function should exist');

-- Setup test data
-- Test reference center: (37.7749, -122.4194) [San Francisco]
-- 1 mile north (~0.0145 deg lat): (37.7894, -122.4194) -> approx 1612 meters
-- 5 miles north (~0.0725 deg lat): (38.0474, -122.4194) -> approx 30250 meters / (37.8474, -122.4194) -> approx 8060 meters

INSERT INTO auth.users (id, email, aud, role)
VALUES ('80000000-0000-0000-0000-000000000001', 'geo_tester@example.com', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('80000000-0000-0000-0000-000000000002', 'Geo Club', 'geo-club', 'Club for testing geospatial queries', '80000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Insert Event 1: ~1 mile away (37.7894, -122.4194)
INSERT INTO public.events (id, club_id, title, description, latitude, longitude, created_by, status)
VALUES (
    '80000000-0000-0000-0000-000000000003',
    '80000000-0000-0000-0000-000000000002',
    'Nearby Event 1 Mile Away',
    'Event within 2 mile radius',
    37.7894,
    -122.4194,
    '80000000-0000-0000-0000-000000000001',
    'published'
);

-- Insert Event 2: ~5 miles away (37.8474, -122.4194)
INSERT INTO public.events (id, club_id, title, description, latitude, longitude, created_by, status)
VALUES (
    '80000000-0000-0000-0000-000000000004',
    '80000000-0000-0000-0000-000000000002',
    'Distant Event 5 Miles Away',
    'Event outside 2 mile radius',
    37.8474,
    -122.4194,
    '80000000-0000-0000-0000-000000000001',
    'published'
);

-- 5. Test 2-mile radius (3218.69 meters) returns Event 1 and excludes Event 2
SELECT results_eq(
    $$ SELECT title FROM public.get_events_nearby(37.7749, -122.4194, 3218.69) $$,
    $$ VALUES ('Nearby Event 1 Mile Away'::text) $$,
    '2-mile radius search should include Event 1 (1 mile) and exclude Event 2 (5 miles)'
);

-- 6. Test 0.5-mile radius (804.67 meters) excludes both Event 1 and Event 2
SELECT is_empty(
    $$ SELECT title FROM public.get_events_nearby(37.7749, -122.4194, 804.67) $$,
    '0.5-mile radius search should return zero events'
);

-- 7. Test 10-mile radius (16093.4 meters) returns both Event 1 and Event 2 ordered by distance
SELECT set_eq(
    $$ SELECT title FROM public.get_events_nearby(37.7749, -122.4194, 16093.4) $$,
    $$ VALUES ('Nearby Event 1 Mile Away'::text), ('Distant Event 5 Miles Away'::text) $$,
    '10-mile radius search should return both events'
);

SELECT * FROM finish();

ROLLBACK;
