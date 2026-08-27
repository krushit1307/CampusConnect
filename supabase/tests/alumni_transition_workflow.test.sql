-- ============================================================
-- Test Suite: alumni_transition_workflow.test.sql
-- Description: Verifies senior graduation cron transitions and rsvp archives.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(8);

-- 1. Check schema components
SELECT has_column('public', 'profiles', 'expected_graduation_date', 'profiles should have expected_graduation_date column');
SELECT has_table('public', 'archived_rsvps', 'archived_rsvps table should exist');
SELECT has_function('public', 'process_graduating_users', 'process_graduating_users function should exist');

-- 2. Mock profiles, expected graduation dates, club memberships and RSVPs
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000aa1', 'senior@student.edu'),
    ('00000000-0000-0000-0000-000000000aa2', 'junior@student.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email, role, expected_graduation_date)
VALUES
    ('00000000-0000-0000-0000-000000000aa1', 'Senior', 'Grad', 'senior_g', 'senior@student.edu', 'student', now()::DATE - INTERVAL '1 day'), -- graduated
    ('00000000-0000-0000-0000-000000000aa2', 'Junior', 'Stud', 'junior_s', 'junior@student.edu', 'student', now()::DATE + INTERVAL '1 year') -- not graduated yet
ON CONFLICT (id) DO NOTHING;

-- Mock club memberships (Senior is President, Junior is Member)
INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('00000000-0000-0000-0000-000000000ac1', 'Graduation Club', 'graduation-club', '00000000-0000-0000-0000-000000000aa1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_members (id, club_id, user_id, role, status, joined_at)
VALUES
    ('00000000-0000-0000-0000-000000000am1', '00000000-0000-0000-0000-000000000ac1', '00000000-0000-0000-0000-000000000aa1', 'PRESIDENT', 'approved', now() - INTERVAL '10 days'),
    ('00000000-0000-0000-0000-000000000am2', '00000000-0000-0000-0000-000000000ac1', '00000000-0000-0000-0000-000000000aa2', 'MEMBER', 'approved', now() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

-- Mock RSVPs
INSERT INTO public.venues (id, name, building, capacity)
VALUES ('00000000-0000-0000-0000-000000000av1', 'Graduation Room', 'Main Hall', 100)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by, venue_id)
VALUES (
    '00000000-0000-0000-0000-000000000ae5',
    '00000000-0000-0000-0000-000000000ac1',
    'Graduation Party',
    'published',
    now() + INTERVAL '1 hour',
    now() + INTERVAL '2 hours',
    '00000000-0000-0000-0000-000000000aa1',
    '00000000-0000-0000-0000-000000000av1'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_rsvps (id, event_id, user_id, status, checked_in)
VALUES
    ('00000000-0000-0000-0000-000000000ar1', '00000000-0000-0000-0000-000000000ae5', '00000000-0000-0000-0000-000000000aa1', 'attending', false),
    ('00000000-0000-0000-0000-000000000ar2', '00000000-0000-0000-0000-000000000ae5', '00000000-0000-0000-0000-000000000aa2', 'attending', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Execute cron processor function
SELECT results_eq(
    $$
    SELECT public.process_graduating_users();
    $$,
    ARRAY[1],
    'Exactly 1 user (Senior) should be processed and transitioned'
);

-- 4. Verify outcomes
-- Senior's role should be alumni
SELECT results_eq(
    $$
    SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000aa1';
    $$,
    ARRAY['alumni'::public.user_role],
    'Seniors role should transition to alumni'
);

-- Senior should be stripped of club executive powers
SELECT results_eq(
    $$
    SELECT COUNT(*)::INTEGER FROM public.club_members WHERE user_id = '00000000-0000-0000-0000-000000000aa1';
    $$,
    ARRAY[0],
    'Seniors club memberships should be deleted'
);

-- Senior's RSVPs should be archived
SELECT results_eq(
    $$
    SELECT COUNT(*)::INTEGER FROM public.archived_rsvps WHERE user_id = '00000000-0000-0000-0000-000000000aa1';
    $$,
    ARRAY[1],
    'Seniors RSVPs should be copied to archived_rsvps'
);

-- Senior's active RSVPs should be deleted
SELECT results_eq(
    $$
    SELECT COUNT(*)::INTEGER FROM public.event_rsvps WHERE user_id = '00000000-0000-0000-0000-000000000aa1';
    $$,
    ARRAY[0],
    'Seniors active RSVPs should be deleted'
);

ROLLBACK;
