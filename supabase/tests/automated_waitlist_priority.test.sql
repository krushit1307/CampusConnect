-- ============================================================
-- Test Suite: automated_waitlist_priority.test.sql
-- Description: Verifies multi-tier waitlist priority algorithms, triggers, and scoring RPCs.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(10);

-- 1. Schema check
SELECT has_column('public', 'events', 'priority_rules', 'events table should have priority_rules column');
SELECT has_column('public', 'profiles', 'graduation_year', 'profiles table should have graduation_year column');

SELECT has_function('public', 'promote_waitlist_attendee', 'promote_waitlist_attendee() function should exist');
SELECT has_function('public', 'get_waitlist_score', ARRAY['uuid', 'uuid'], 'get_waitlist_score() RPC should exist');

-- 2. Mock setup
INSERT INTO public.profiles (id, first_name, last_name, graduation_year, role)
VALUES 
    ('33333333-3333-3333-3333-333333333301', 'Freshman', 'One', 2030, 'student'),
    ('33333333-3333-3333-3333-333333333302', 'Senior', 'Two', EXTRACT(YEAR FROM NOW())::integer, 'student'),
    ('33333333-3333-3333-3333-333333333303', 'Freshman', 'Three', 2030, 'student'),
    ('33333333-3333-3333-3333-333333333304', 'Senior', 'Four', EXTRACT(YEAR FROM NOW())::integer, 'student'),
    ('33333333-3333-3333-3333-333333333305', 'Spot', 'Holder', 2028, 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug)
VALUES ('33333333-3333-3333-3333-3333333333aa', 'Priority Test Club', 'priority-test-club')
ON CONFLICT (id) DO NOTHING;

-- Event with priority rules enabled (1 capacity)
INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, start_date, end_date, status, priority_rules)
VALUES (
    '33333333-3333-3333-3333-3333333333bb', 
    '33333333-3333-3333-3333-3333333333aa', 
    'Priority Gala', 
    1, 
    1, 
    NOW() + INTERVAL '1 day', 
    NOW() + INTERVAL '1 day' + INTERVAL '2 hours', 
    'published',
    '{"prioritize_seniors": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 3. Run Test A: Graduating Senior takes precedence over older Freshman waitlist entry
-- Spot Holder takes the only ticket spot
INSERT INTO public.event_rsvps (event_id, user_id)
VALUES ('33333333-3333-3333-3333-3333333333bb', '33333333-3333-3333-3333-333333333305');

-- Freshman joins waitlist 2 hours ago
INSERT INTO public.event_waitlist (event_id, user_id, created_at)
VALUES ('33333333-3333-3333-3333-3333333333bb', '33333333-3333-3333-3333-333333333301', NOW() - INTERVAL '2 hours');

-- Graduating Senior joins waitlist 1 hour ago
INSERT INTO public.event_waitlist (event_id, user_id, created_at)
VALUES ('33333333-3333-3333-3333-3333333333bb', '33333333-3333-3333-3333-333333333302', NOW() - INTERVAL '1 hour');

-- Verify RPC returns correct scores
SELECT is(
    (SELECT senior_score FROM public.get_waitlist_score('33333333-3333-3333-3333-3333333333bb', '33333333-3333-3333-3333-333333333302')),
    500.0::numeric,
    'get_waitlist_score Senior score should be 500 for senior under active rule'
);

SELECT is(
    (SELECT senior_score FROM public.get_waitlist_score('33333333-3333-3333-3333-3333333333bb', '33333333-3333-3333-3333-333333333301')),
    0.0::numeric,
    'get_waitlist_score Senior score should be 0 for freshman under active rule'
);

-- Cancel Spot Holder's RSVP (triggers automatic trigger promotion)
DELETE FROM public.event_rsvps 
WHERE event_id = '33333333-3333-3333-3333-3333333333bb' 
  AND user_id = '33333333-3333-3333-3333-333333333305';

-- Assert Senior (User 2) is promoted, not Freshman (User 1)
SELECT results_eq(
    $$ SELECT user_id FROM public.event_rsvps WHERE event_id = '33333333-3333-3333-3333-3333333333bb' $$,
    $$ VALUES ('33333333-3333-3333-3333-333333333302'::uuid) $$,
    'Senior User 2 should be promoted over older Freshman User 1'
);


-- 4. Run Test B: Tie-Breaking: strictly chronological between two Graduating Seniors
-- Reset RSVP / waitlist
DELETE FROM public.event_rsvps WHERE event_id = '33333333-3333-3333-3333-3333333333bb';
DELETE FROM public.event_waitlist WHERE event_id = '33333333-3333-3333-3333-3333333333bb';

-- Spot Holder takes the spot
INSERT INTO public.event_rsvps (event_id, user_id)
VALUES ('33333333-3333-3333-3333-3333333333bb', '33333333-3333-3333-3333-333333333305');

-- Senior A (User 2) joins waitlist 2 hours ago
INSERT INTO public.event_waitlist (event_id, user_id, created_at)
VALUES ('33333333-3333-3333-3333-3333333333bb', '33333333-3333-3333-3333-333333333302', NOW() - INTERVAL '2 hours');

-- Senior B (User 4) joins waitlist 1 hour ago
INSERT INTO public.event_waitlist (event_id, user_id, created_at)
VALUES ('33333333-3333-3333-3333-3333333333bb', '33333333-3333-3333-3333-333333333304', NOW() - INTERVAL '1 hour');

-- Cancel RSVP
DELETE FROM public.event_rsvps 
WHERE event_id = '33333333-3333-3333-3333-3333333333bb' 
  AND user_id = '33333333-3333-3333-3333-333333333305';

-- Senior A (User 2) who joined first should be promoted
SELECT results_eq(
    $$ SELECT user_id FROM public.event_rsvps WHERE event_id = '33333333-3333-3333-3333-3333333333bb' $$,
    $$ VALUES ('33333333-3333-3333-3333-333333333302'::uuid) $$,
    'Senior User 2 who joined first should win chronological tie breaker'
);


-- 5. Run Test C: Non-Priority Fallback
-- Event with priority rules disabled
INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, start_date, end_date, status, priority_rules)
VALUES (
    '33333333-3333-3333-3333-3333333333dd', 
    '33333333-3333-3333-3333-3333333333aa', 
    'Standard Gala', 
    1, 
    1, 
    NOW() + INTERVAL '1 day', 
    NOW() + INTERVAL '1 day' + INTERVAL '2 hours', 
    'published',
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- Spot Holder takes the spot
INSERT INTO public.event_rsvps (event_id, user_id)
VALUES ('33333333-3333-3333-3333-3333333333dd', '33333333-3333-3333-3333-333333333305');

-- Freshman (User 1) joins waitlist 2 hours ago
INSERT INTO public.event_waitlist (event_id, user_id, created_at)
VALUES ('33333333-3333-3333-3333-3333333333dd', '33333333-3333-3333-3333-333333333301', NOW() - INTERVAL '2 hours');

-- Senior (User 2) joins waitlist 1 hour ago
INSERT INTO public.event_waitlist (event_id, user_id, created_at)
VALUES ('33333333-3333-3333-3333-3333333333dd', '33333333-3333-3333-3333-333333333302', NOW() - INTERVAL '1 hour');

-- Cancel RSVP
DELETE FROM public.event_rsvps 
WHERE event_id = '33333333-3333-3333-3333-3333333333dd' 
  AND user_id = '33333333-3333-3333-3333-333333333305';

-- Freshman (User 1) who joined first should be promoted
SELECT results_eq(
    $$ SELECT user_id FROM public.event_rsvps WHERE event_id = '33333333-3333-3333-3333-3333333333dd' $$,
    $$ VALUES ('33333333-3333-3333-3333-333333333301'::uuid) $$,
    'Without active priority rules, trigger falls back strictly to chronological FIFO'
);

ROLLBACK;
