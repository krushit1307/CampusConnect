-- Test suite: Live GPS Bus Tracker Test
BEGIN;
SELECT plan(6);

-- Seed mocks
INSERT INTO public.clubs (id, name, slug, description, visibility, is_private)
VALUES ('c_bus_1', 'Bus Club', 'bus-club', 'desc', 'public', false);

INSERT INTO public.events (id, title, description, start_date, created_by, club_id, bus_tracker_active)
VALUES ('e_bus_1', 'Offsite Retreat', 'Organized bus retreat', NOW() + INTERVAL '2 days', '00000000-0000-0000-0000-000000000000', 'c_bus_1', false);

INSERT INTO auth.users (id, email)
VALUES 
    ('44444444-4444-4444-4444-444444444444', 'captain@connect.edu'),
    ('55555555-5555-5555-5555-555555555555', 'randomstudent@connect.edu');

-- Verify columns exist
SELECT has_column('public', 'events', 'bus_tracker_active', 'events table should have bus_tracker_active column');
SELECT has_column('public', 'events', 'bus_latitude', 'events table should have bus_latitude column');
SELECT has_column('public', 'events', 'bus_longitude', 'events table should have bus_longitude column');

-- Test 1: Start broadcasting bus location claiming captaincy
SELECT results_eq(
    $$ SELECT public.update_bus_location('e_bus_1', 42.123, -71.456)->>'success' $$,
    $$ VALUES ('true') $$,
    'First update should successfully claim captaincy and start broadcast'
);

-- Test 2: Verify active status and updated coordinates
SELECT results_eq(
    $$ SELECT bus_tracker_active, bus_latitude, bus_longitude FROM public.events WHERE id = 'e_bus_1' $$,
    $$ VALUES (true, 42.123, -71.456) $$,
    'Coordinates and status must update accurately in database table'
);

-- Test 3: Terminate broadcast successfully
SELECT results_eq(
    $$ SELECT public.terminate_bus_tracker('e_bus_1')->>'success' $$,
    $$ VALUES ('true') $$,
    'Should terminate tracking successfully'
);

SELECT * FROM finish();
ROLLBACK;
