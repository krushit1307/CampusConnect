-- ============================================================
-- Test Suite: interactive_campus_tours.test.sql
-- Description: Verifies that public showcase flags and guest RLS access rules are properly enforced.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(5);

-- 1. Check schema components
SELECT has_column('public', 'events', 'is_public_showcase', 'events table should have is_public_showcase column');

-- 2. Mock users, club, and events
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000e11', 'student-tour@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000e11', 'Rob', 'Student', 'rob_tour_student', 'student-tour@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000ec1',
    'Tour Club',
    'tour-club',
    '00000000-0000-0000-0000-000000000e11'
)
ON CONFLICT (id) DO NOTHING;

-- Public Showcase Event
INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by, is_public_showcase, is_private)
VALUES (
    '00000000-0000-0000-0000-000000000ee1',
    '00000000-0000-0000-0000-000000000ec1',
    'Spring Carnival Showcase',
    'published',
    now() + INTERVAL '1 day',
    now() + INTERVAL '1 day 2 hours',
    '00000000-0000-0000-0000-000000000e11',
    true,
    false
)
ON CONFLICT (id) DO NOTHING;

-- Regular Non-Showcase Public Event
INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by, is_public_showcase, is_private)
VALUES (
    '00000000-0000-0000-0000-000000000ee2',
    '00000000-0000-0000-0000-000000000ec1',
    'Internal Coding Session',
    'published',
    now() + INTERVAL '2 days',
    now() + INTERVAL '2 days 2 hours',
    '00000000-0000-0000-0000-000000000e11',
    false,
    false
)
ON CONFLICT (id) DO NOTHING;

-- 3. Assert anonymous reads: allowed for showcase event, blocked for regular event
SET local role anon;

SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.events
    WHERE id = '00000000-0000-0000-0000-000000000ee1';
    $$,
    ARRAY[1],
    'Anonymous guest should be allowed to view public showcase events'
);

SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.events
    WHERE id = '00000000-0000-0000-0000-000000000ee2';
    $$,
    ARRAY[0],
    'Anonymous guest should NOT be allowed to view regular public events (RLS block)'
);

-- 4. Assert authenticated reads: allowed for both events
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000e11';

SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.events
    WHERE id = '00000000-0000-0000-0000-000000000ee1';
    $$,
    ARRAY[1],
    'Authenticated student should be allowed to view public showcase events'
);

SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.events
    WHERE id = '00000000-0000-0000-0000-000000000ee2';
    $$,
    ARRAY[1],
    'Authenticated student should be allowed to view regular public events'
);

ROLLBACK;
