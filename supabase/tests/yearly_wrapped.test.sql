-- ============================================================
-- Test Suite: yearly_wrapped.test.sql
-- Description: Verifies yearly review metrics calculations, hours aggregates, top tags.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(6);

-- 1. Check function exists
SELECT has_function('public', 'get_yearly_wrapped', 'get_yearly_wrapped function should exist');

-- 2. Mock user, club, events, RSVPs and points
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000000dd1', 'wrapped-user@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES ('00000000-0000-0000-0000-000000000dd1', 'Alice', 'Wrapped', 'alice_wrapped', 'wrapped-user@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000dc1',
    'Wrapped Club',
    'wrapped-club',
    '00000000-0000-0000-0000-000000000dd1'
)
ON CONFLICT (id) DO NOTHING;

-- Create two events: Tech and Art
INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by, tags)
VALUES
    ('00000000-0000-0000-0000-000000000de1', '00000000-0000-0000-0000-000000000dc1', 'Tech Fest', 'published', '2026-05-10T10:00:00Z', '2026-05-10T14:00:00Z', '00000000-0000-0000-0000-000000000dd1', ARRAY['Tech', 'Coding']),
    ('00000000-0000-0000-0000-000000000de2', '00000000-0000-0000-0000-000000000dc1', 'Art Expo', 'published', '2026-06-12T12:00:00Z', '2026-06-12T15:00:00Z', '00000000-0000-0000-0000-000000000dd1', ARRAY['Art', 'Creative'])
ON CONFLICT (id) DO NOTHING;

-- RSVPs with checked_in status
INSERT INTO public.event_rsvps (id, event_id, user_id, status, checked_in, rsvp_at)
VALUES
    ('00000000-0000-0000-0000-000000000dr1', '00000000-0000-0000-0000-000000000de1', '00000000-0000-0000-0000-000000000dd1', 'attending', true, '2026-05-10T09:00:00Z'),
    ('00000000-0000-0000-0000-000000000dr2', '00000000-0000-0000-0000-000000000de2', '00000000-0000-0000-0000-000000000dd1', 'attending', true, '2026-06-12T11:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Add gamification points
INSERT INTO public.gamification_points (id, user_id, points, reason, created_at)
VALUES ('00000000-0000-0000-0000-000000000dg1', '00000000-0000-0000-0000-000000000dd1', 100, 'RSVP Event Checkin', now())
ON CONFLICT (id) DO NOTHING;

-- 3. Run get_yearly_wrapped and assert results
SELECT results_eq(
    $$
    SELECT (public.get_yearly_wrapped('00000000-0000-0000-0000-000000000dd1', 2026)->>'total_events_attended')::integer;
    $$,
    ARRAY[2],
    'Attended count should be 2'
);

SELECT results_eq(
    $$
    SELECT (public.get_yearly_wrapped('00000000-0000-0000-0000-000000000dd1', 2026)->>'total_hours_spent')::numeric;
    $$,
    ARRAY[7::numeric], -- (14 - 10 = 4 hours) + (15 - 12 = 3 hours) = 7 hours
    'Total hours spent should be 7'
);

SELECT results_eq(
    $$
    SELECT public.get_yearly_wrapped('00000000-0000-0000-0000-000000000dd1', 2026)->>'top_tag';
    $$,
    ARRAY['Art'], -- Alphabetically first top tag if counts tie (Art and Coding and Creative and Tech all tie at 1)
    'Top tag should tie-break alphabetically'
);

SELECT results_eq(
    $$
    SELECT (public.get_yearly_wrapped('00000000-0000-0000-0000-000000000dd1', 2026)->>'gamification_percentile')::integer;
    $$,
    ARRAY[1], -- Only user in active leaderboard points is Alice, so she is top 1 (or 1%)
    'Gamification percentile should compute relative ranks'
);

SELECT results_eq(
    $$
    SELECT jsonb_array_length(public.get_yearly_wrapped('00000000-0000-0000-0000-000000000dd1', 2026)->'top_events');
    $$,
    ARRAY[2],
    'Top events list length should match attended events count (up to 3)'
);

ROLLBACK;
