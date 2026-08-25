-- ============================================================
-- Test Suite: dietary_yield_optimizer.test.sql
-- Description: Verifies dietary yield optimizer RPC and constraint RLS.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(5);

-- 1. Check table existence
SELECT has_table('event_dietary_constraints', 'event_dietary_constraints table should exist');

-- 2. Check function existence
SELECT has_function('public', 'assign_excess_dietary_meals', ARRAY['UUID', 'TEXT', 'INTEGER'], 'assign_excess_dietary_meals function should exist');

-- 3. Mock data setup
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000df1', 'vegan@student.edu'),
    ('00000000-0000-0000-0000-000000000df2', 'general1@student.edu'),
    ('00000000-0000-0000-0000-000000000df3', 'general2@student.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000df1', 'Vegan', 'User', 'v_user', 'vegan@student.edu'),
    ('00000000-0000-0000-0000-000000000df2', 'General', 'One', 'g_one', 'general1@student.edu'),
    ('00000000-0000-0000-0000-000000000df3', 'General', 'Two', 'g_two', 'general2@student.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_preferences (user_id, dietary_restrictions)
VALUES
    ('00000000-0000-0000-0000-000000000df1', ARRAY['Vegan']),
    ('00000000-0000-0000-0000-000000000df2', ARRAY[]::TEXT[]),
    ('00000000-0000-0000-0000-000000000df3', ARRAY['none']::TEXT[])
ON CONFLICT (user_id) DO UPDATE SET dietary_restrictions = EXCLUDED.dietary_restrictions;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000dc2',
    'Yield Club',
    'yield-club',
    '00000000-0000-0000-0000-000000000df1'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000de6',
    '00000000-0000-0000-0000-000000000dc2',
    'Yield Dinner',
    'published',
    now() + INTERVAL '1 hour',
    now() + INTERVAL '2 hours',
    '00000000-0000-0000-0000-000000000df1'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_rsvps (id, event_id, user_id, status, checked_in)
VALUES
    ('00000000-0000-0000-0000-000000000dr3', '00000000-0000-0000-0000-000000000de6', '00000000-0000-0000-0000-000000000df1', 'attending', false),
    ('00000000-0000-0000-0000-000000000dr4', '00000000-0000-0000-0000-000000000de6', '00000000-0000-0000-0000-000000000df2', 'attending', false),
    ('00000000-0000-0000-0000-000000000dr5', '00000000-0000-0000-0000-000000000de6', '00000000-0000-0000-0000-000000000df3', 'attending', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Test RPC execution - assign 1 vegan meal to general attendees
SELECT lives_ok(
    $$
    SELECT public.assign_excess_dietary_meals('00000000-0000-0000-0000-000000000de6', 'Vegan', 1);
    $$,
    'assign_excess_dietary_meals should execute successfully'
);

-- 5. Test results: 
-- - Only 1 general RSVP should get assigned the 'Vegan' meal
-- - The Vegan user's RSVP remains NULL because they already have Vegan profile preferences
SELECT results_eq(
    $$
    SELECT COUNT(*)::INTEGER FROM public.event_rsvps 
    WHERE event_id = '00000000-0000-0000-0000-000000000de6' 
      AND assigned_dietary_meal = 'Vegan';
    $$,
    ARRAY[1],
    'Exactly 1 general RSVP should be flagged with a Vegan meal'
);

SELECT results_eq(
    $$
    SELECT assigned_dietary_meal FROM public.event_rsvps 
    WHERE event_id = '00000000-0000-0000-0000-000000000de6' 
      AND user_id = '00000000-0000-0000-0000-000000000df1';
    $$,
    ARRAY[NULL::TEXT],
    'Strict dietary RSVP (Vegan user) should not have assigned_dietary_meal flag set'
);

SELECT * FROM finish();
ROLLBACK;
