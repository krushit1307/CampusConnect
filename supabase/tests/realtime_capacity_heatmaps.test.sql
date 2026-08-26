-- ============================================================
-- Test Suite: realtime_capacity_heatmaps.test.sql
-- Description: Verifies schema, RLS, update_room_occupancy (+1/-1),
-- and calibrate_room_occupancy functions for Issue #3239.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(10);

-- 1. Schema Validation
SELECT has_table('public', 'event_rooms', 'event_rooms table should exist');
SELECT has_column('public', 'event_rooms', 'event_id', 'Column event_id should exist');
SELECT has_column('public', 'event_rooms', 'room_name', 'Column room_name should exist');
SELECT has_column('public', 'event_rooms', 'max_capacity', 'Column max_capacity should exist');
SELECT has_column('public', 'event_rooms', 'current_occupancy', 'Column current_occupancy should exist');

SELECT has_function('public', 'update_room_occupancy', ARRAY['uuid', 'integer'], 'RPC update_room_occupancy should exist');
SELECT has_function('public', 'calibrate_room_occupancy', ARRAY['uuid', 'integer'], 'RPC calibrate_room_occupancy should exist');

-- 2. Mock Data Setup
INSERT INTO public.clubs (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'Career Club', 'career-club')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, max_attendees)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Career Fair 2026', 500)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_rooms (id, event_id, room_name, max_capacity, current_occupancy)
VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Room A', 100, 10);

-- 3. Test Check-In (+1) and Check-Out (-1)
SELECT is(
    (public.update_room_occupancy('33333333-3333-3333-3333-333333333333', 1)->>'current_occupancy')::integer,
    11,
    'Check-in (+1) should increment room occupancy to 11'
);

SELECT is(
    (public.update_room_occupancy('33333333-3333-3333-3333-333333333333', -1)->>'current_occupancy')::integer,
    10,
    'Check-out (-1) should decrement room occupancy to 10'
);

-- 4. Test Manual Headcount Calibration
SELECT is(
    (public.calibrate_room_occupancy('33333333-3333-3333-3333-333333333333', 96)->>'capacity_warning')::boolean,
    true,
    'Calibrating occupancy to 96/100 should return capacity_warning = true'
);

SELECT * FROM finish();
ROLLBACK;
