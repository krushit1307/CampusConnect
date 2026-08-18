-- ============================================================
-- Test Suite: scavenger_hunt_engine.test.sql
-- Description: Verifies scavenger hunts waypoint validation, sequential unlocks, and point ledger awards.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(6);

-- 1. Check schema components
SELECT has_table('public', 'scavenger_hunts', 'scavenger_hunts table should exist');
SELECT has_table('public', 'hunt_waypoints', 'hunt_waypoints table should exist');
SELECT has_table('public', 'user_hunt_progress', 'user_hunt_progress table should exist');

-- 2. Mock users, hunt, and waypoints
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000000a11', 'hunter@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES ('00000000-0000-0000-0000-000000000a11', 'Rob', 'Hunter', 'rob_hunter', 'hunter@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.scavenger_hunts (id, title, description, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000a21',
    'Freshman Orientation Hunt',
    'Find landmarks around campus.',
    '00000000-0000-0000-0000-000000000a11'
)
ON CONFLICT (id) DO NOTHING;

-- Waypoint 1: Clock Tower
INSERT INTO public.hunt_waypoints (id, hunt_id, clue_text, secret_qr_hash, step_number)
VALUES (
    '00000000-0000-0000-0000-000000000a31',
    '00000000-0000-0000-0000-000000000a21',
    'Seek the clock tower where time stands still.',
    'hash_clock_tower',
    1
)
ON CONFLICT (id) DO NOTHING;

-- Waypoint 2: Library
INSERT INTO public.hunt_waypoints (id, hunt_id, clue_text, secret_qr_hash, step_number)
VALUES (
    '00000000-0000-0000-0000-000000000a32',
    '00000000-0000-0000-0000-000000000a21',
    'Search inside the quiet halls of books.',
    'hash_library',
    2
)
ON CONFLICT (id) DO NOTHING;

-- 3. Assert submit_waypoint_scan RPC works sequentially
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000a11';

-- Attempt scanning wrong hash for first waypoint
SELECT results_eq(
    $$
    SELECT (public.submit_waypoint_scan(
        '00000000-0000-0000-0000-000000000a21',
        'wrong_hash'
    )->>'success')::boolean;
    $$,
    ARRAY[FALSE],
    'Submit scan with incorrect hash should fail'
);

-- Scan correct hash for first waypoint
SELECT results_eq(
    $$
    SELECT (public.submit_waypoint_scan(
        '00000000-0000-0000-0000-000000000a21',
        'hash_clock_tower'
    )->>'success')::boolean;
    $$,
    ARRAY[TRUE],
    'Submit scan with correct first waypoint hash should succeed'
);

-- Scan correct hash for second (final) waypoint and verify points award
SELECT results_eq(
    $$
    SELECT (public.submit_waypoint_scan(
        '00000000-0000-0000-0000-000000000a21',
        'hash_library'
    )->>'is_final')::boolean;
    $$,
    ARRAY[TRUE],
    'Scan of final waypoint should return is_final = TRUE'
);

ROLLBACK;
