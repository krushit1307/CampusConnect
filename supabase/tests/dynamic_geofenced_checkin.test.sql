-- ============================================================
-- Test Suite: dynamic_geofenced_checkin.test.sql
-- Description: Verifies the venue coordinates schema, resolution order (venue > event), and RPC triggers.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(8);

-- 1. Verify schema elements exist on venues table
SELECT has_column('public', 'venues', 'latitude', 'venues table should have latitude column');
SELECT has_column('public', 'venues', 'longitude', 'venues table should have longitude column');
SELECT has_column('public', 'venues', 'geofence_radius_meters', 'venues table should have geofence_radius_meters column');

-- 2. Verify coordination index on venues table
SELECT has_index(
    'public',
    'venues',
    'idx_venues_coords',
    'venues table should have coordinate index idx_venues_coords'
);

-- 3. Set up mock profile, venue, event, and RSVP
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000000099', 'auto-checkin@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, full_name, handle, email)
VALUES ('00000000-0000-0000-0000-000000000099', 'Checkin Student', 'checkin_student', 'auto-checkin@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('00000000-0000-0000-0000-00000000009c', 'Checkin Club', 'checkin-club', '00000000-0000-0000-0000-000000000099')
ON CONFLICT (id) DO NOTHING;

-- Insert a mock venue with coordinates at (30.0, 76.0)
INSERT INTO public.venues (id, name, building, capacity, latitude, longitude, geofence_radius_meters)
VALUES (
    '00000000-0000-0000-0000-00000000009v',
    'Arena',
    'Athletics Complex',
    5000,
    30.0,
    76.0,
    150
)
ON CONFLICT (id) DO NOTHING;

-- Insert a mock event referencing that venue with different default coordinates (0.0, 0.0)
INSERT INTO public.events (id, title, description, location, created_by, club_id, status, start_date, end_date, venue_id, latitude, longitude, geofencing_enabled, geofence_radius_meters)
VALUES (
    '00000000-0000-0000-0000-00000000009e',
    'Main Festival',
    'Campus Festival 2026',
    'Arena',
    '00000000-0000-0000-0000-000000000099',
    '00000000-0000-0000-0000-00000000009c',
    'published',
    NOW() - INTERVAL '30 minutes',
    NOW() + INTERVAL '2 hours',
    '00000000-0000-0000-0000-00000000009v',
    0.0, -- event level lat
    0.0, -- event level lng
    TRUE,
    50  -- event level radius
)
ON CONFLICT (id) DO NOTHING;

-- Insert RSVP for the user
INSERT INTO public.event_rsvps (id, event_id, user_id, status, checked_in)
VALUES (
    '00000000-0000-0000-0000-00000000009r',
    '00000000-0000-0000-0000-00000000009e',
    '00000000-0000-0000-0000-000000000099',
    'attending',
    FALSE
)
ON CONFLICT (id) DO NOTHING;

-- 4. Set current user authenticated session
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000099"}', true);

-- 5. Assert check_in_via_geofence succeeds when within the VENUE coordinates radius, despite event coordinates being far away
SELECT results_eq(
    $$
    SELECT (public.check_in_via_geofence(
        '00000000-0000-0000-0000-00000000009r',
        30.0001, -- within 150m of (30.0, 76.0)
        76.0001
    ) ->> 'success')::boolean;
    $$,
    ARRAY[TRUE],
    'check_in_via_geofence should resolve coordinates from the venue level and succeed'
);

-- 6. Reset check_in flag for further testing
UPDATE public.event_rsvps SET checked_in = FALSE WHERE id = '00000000-0000-0000-0000-00000000009r';

-- 7. Assert check_in fails when coordinates are far from the venue but close to event level coords (0.0, 0.0)
SELECT results_eq(
    $$
    SELECT (public.check_in_via_geofence(
        '00000000-0000-0000-0000-00000000009r',
        0.0001, -- close to event level coords (0.0, 0.0), but far from venue
        0.0001
    ) ->> 'success')::boolean;
    $$,
    ARRAY[FALSE],
    'check_in_via_geofence should reject coordinates that are close to the event defaults but far from the actual venue'
);

-- 8. Test Fallback to Event coordinates when venue_id is NULL
-- Insert another event without venue
INSERT INTO public.events (id, title, description, location, created_by, club_id, status, start_date, end_date, venue_id, latitude, longitude, geofencing_enabled, geofence_radius_meters)
VALUES (
    '00000000-0000-0000-0000-0000000000f2',
    'Informal Meetup',
    'Meetup near lake',
    'Lake',
    '00000000-0000-0000-0000-000000000099',
    '00000000-0000-0000-0000-00000000009c',
    'published',
    NOW() - INTERVAL '15 minutes',
    NOW() + INTERVAL '1 hour',
    NULL, -- no venue
    40.0, -- event level lat
    -70.0, -- event level lng
    TRUE,
    100
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_rsvps (id, event_id, user_id, status, checked_in)
VALUES (
    '00000000-0000-0000-0000-0000000000f3',
    '00000000-0000-0000-0000-0000000000f2',
    '00000000-0000-0000-0000-000000000099',
    'attending',
    FALSE
)
ON CONFLICT (id) DO NOTHING;

-- Assert check-in succeeds using event-level fallback
SELECT results_eq(
    $$
    SELECT (public.check_in_via_geofence(
        '00000000-0000-0000-0000-0000000000f3',
        40.0001,
        -70.0001
    ) ->> 'success')::boolean;
    $$,
    ARRAY[TRUE],
    'check_in_via_geofence should correctly fall back to event level coordinates when event venue is not specified'
);

ROLLBACK;
