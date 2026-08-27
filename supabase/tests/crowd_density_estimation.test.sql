-- ============================================================
-- Test Suite: crowd_density_estimation.test.sql
-- Description: Verifies venue square footage, checkins density ratios and crowd status.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(6);

-- 1. Check schema components
SELECT has_column('public', 'venues', 'square_footage', 'venues should have square_footage column');
SELECT has_function('public', 'get_live_density', 'get_live_density function should exist');

-- 2. Mock users, club, venue, event, and check-in RSVPs
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000ee1', 'u1@campus.edu'),
    ('00000000-0000-0000-0000-000000000ee2', 'u2@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000ee1', 'U1', 'P', 'u1_p', 'u1@campus.edu'),
    ('00000000-0000-0000-0000-000000000ee2', 'U2', 'P', 'u2_p', 'u2@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000ec1',
    'Density Club',
    'density-club',
    '00000000-0000-0000-0000-000000000ee1'
)
ON CONFLICT (id) DO NOTHING;

-- Create venue with 50 square footage (very small room)
INSERT INTO public.venues (id, name, building, capacity, square_footage)
VALUES (
    '00000000-0000-0000-0000-000000000ev1',
    'Tiny Booth',
    'Tech Hub',
    10,
    50
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by, venue_id)
VALUES (
    '00000000-0000-0000-0000-000000000ee5',
    '00000000-0000-0000-0000-000000000ec1',
    'Crowded Meeting',
    'published',
    now() + INTERVAL '1 hour',
    now() + INTERVAL '2 hours',
    '00000000-0000-0000-0000-000000000ee1',
    '00000000-0000-0000-0000-000000000ev1'
)
ON CONFLICT (id) DO NOTHING;

-- Add 2 checked-in RSVPs
-- Ratio = 2 / 50 = 0.04 (threshold for "Getting Busy")
INSERT INTO public.event_rsvps (id, event_id, user_id, status, checked_in)
VALUES
    ('00000000-0000-0000-0000-000000000er1', '00000000-0000-0000-0000-000000000ee5', '00000000-0000-0000-0000-000000000ee1', 'attending', true),
    ('00000000-0000-0000-0000-000000000er2', '00000000-0000-0000-0000-000000000ee5', '00000000-0000-0000-0000-000000000ee2', 'attending', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Execute function and assert results
SELECT results_eq(
    $$
    SELECT checked_in_count FROM public.get_live_density('00000000-0000-0000-0000-000000000ee5');
    $$,
    ARRAY[2],
    'Checked-in count should be 2'
);

SELECT results_eq(
    $$
    SELECT square_footage FROM public.get_live_density('00000000-0000-0000-0000-000000000ee5');
    $$,
    ARRAY[50],
    'Square footage should match the tiny booth (50)'
);

SELECT results_eq(
    $$
    SELECT density_ratio FROM public.get_live_density('00000000-0000-0000-0000-000000000ee5');
    $$,
    ARRAY[0.0400::numeric],
    'Density ratio should be 2 / 50 = 0.0400'
);

SELECT results_eq(
    $$
    SELECT density_status FROM public.get_live_density('00000000-0000-0000-0000-000000000ee5');
    $$,
    ARRAY['Getting Busy'],
    'Density status should classify 0.04 ratio as Getting Busy'
);

ROLLBACK;
