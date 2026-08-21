-- ============================================================
-- Test Suite: event_collision_matrix.test.sql
-- Description: Verifies event collision matrix aggregations and filters.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(6);

-- 1. Check schemas
SELECT has_table('public', 'semesters', 'semesters table should exist');
SELECT has_function('public', 'get_event_collision_matrix', ARRAY['uuid'], 'get_event_collision_matrix function should exist');

-- 2. Insert mock semester, club, and events
INSERT INTO public.semesters (id, name, start_date, end_date)
VALUES (
    '00000000-0000-0000-0000-000000000e01',
    'Fall 2026',
    '2026-09-01 00:00:00+00',
    '2026-12-31 23:59:59+00'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000e11',
    'AI Club',
    'ai-club',
    '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO NOTHING;

-- Event 1: Falls inside semester, Thursday (isodow = 4) at 18:00 (hour = 18)
INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000e21',
    '00000000-0000-0000-0000-000000000e11',
    'AI Seminar',
    'published',
    '2026-09-17 18:00:00+00', -- Thursday
    '2026-09-17 20:00:00+00',
    '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO NOTHING;

-- Event 2: Outside semester (August), Monday (isodow = 1) at 10:00 (hour = 10)
INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000e22',
    '00000000-0000-0000-0000-000000000e11',
    'Summer Hack',
    'published',
    '2026-08-17 10:00:00+00', -- Monday
    '2026-08-17 12:00:00+00',
    '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Assert total counts without semester filter (historical)
SELECT results_eq(
    $$
    SELECT concurrent_events::integer FROM public.get_event_collision_matrix()
    WHERE day_of_week = 4 AND hour_of_day = 18;
    $$,
    ARRAY[1],
    'Unfiltered matrix should count Event 1 on Thursday at 18:00'
);

SELECT results_eq(
    $$
    SELECT concurrent_events::integer FROM public.get_event_collision_matrix()
    WHERE day_of_week = 1 AND hour_of_day = 10;
    $$,
    ARRAY[1],
    'Unfiltered matrix should count Event 2 on Monday at 10:00'
);

-- 4. Assert counts WITH semester filter
SELECT results_eq(
    $$
    SELECT concurrent_events::integer FROM public.get_event_collision_matrix('00000000-0000-0000-0000-000000000e01')
    WHERE day_of_week = 4 AND hour_of_day = 18;
    $$,
    ARRAY[1],
    'Filtered matrix should count Event 1 inside Fall semester'
);

SELECT results_eq(
    $$
    SELECT concurrent_events::integer FROM public.get_event_collision_matrix('00000000-0000-0000-0000-000000000e01')
    WHERE day_of_week = 1 AND hour_of_day = 10;
    $$,
    ARRAY[0],
    'Filtered matrix should NOT count Event 2 because it is outside Fall semester dates'
);

ROLLBACK;
