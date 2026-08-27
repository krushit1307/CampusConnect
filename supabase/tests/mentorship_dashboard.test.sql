-- ============================================================
-- Test Suite: mentorship_dashboard.test.sql
-- Description: Verifies cohort metrics, leadership placements and points lifts.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(6);

-- 1. Check function exists
SELECT has_function('public', 'get_mentorship_cohort_analysis', 'get_mentorship_cohort_analysis function should exist');

-- 2. Mock profiles, mentorship_profiles, mentorship_pairs, gamification_points, and club_members
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000fa1', 'mentor_user@alumni.edu'),
    ('00000000-0000-0000-0000-000000000fa2', 'mentee_user@student.edu'),
    ('00000000-0000-0000-0000-000000000fa3', 'control_user@student.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email, role)
VALUES
    ('00000000-0000-0000-0000-000000000fa1', 'Alumni', 'Mentor', 'mentor_u', 'mentor_user@alumni.edu', 'alumni'),
    ('00000000-0000-0000-0000-000000000fa2', 'Mentee', 'Student', 'mentee_u', 'mentee_user@student.edu', 'student'),
    ('00000000-0000-0000-0000-000000000fa3', 'Control', 'Student', 'control_u', 'control_user@student.edu', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mentorship_profiles (user_id, role, major, capacity)
VALUES
    ('00000000-0000-0000-0000-000000000fa1', 'mentor', 'Computer Science', 2),
    ('00000000-0000-0000-0000-000000000fa2', 'mentee', 'Computer Science', 1)
ON CONFLICT (user_id) DO NOTHING;

-- Insert active match created 3 months ago
INSERT INTO public.mentorship_pairs (id, mentor_id, mentee_id, status, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000fb1',
    '00000000-0000-0000-0000-000000000fa1',
    '00000000-0000-0000-0000-000000000fa2',
    'active',
    now() - INTERVAL '90 days'
)
ON CONFLICT (id) DO NOTHING;

-- Mock gamification points
-- Mentee gains 150 points post-match
INSERT INTO public.gamification_points (id, user_id, points, created_at)
VALUES
    ('00000000-0000-0000-0000-000000000fg1', '00000000-0000-0000-0000-000000000fa2', 150, now() - INTERVAL '30 days'),
    -- Control gains 50 points
    ('00000000-0000-0000-0000-000000000fg2', '00000000-0000-0000-0000-000000000fa3', 50, now() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

-- Mock club roles (Mentee becomes President)
INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('00000000-0000-0000-0000-000000000fc1', 'Mentorship Club', 'mentorship-club', '00000000-0000-0000-0000-000000000fa2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_members (id, club_id, user_id, role, status, joined_at)
VALUES
    ('00000000-0000-0000-0000-000000000fm1', '00000000-0000-0000-0000-000000000fc1', '00000000-0000-0000-0000-000000000fa2', 'PRESIDENT', 'approved', now() - INTERVAL '20 days')
ON CONFLICT (id) DO NOTHING;

-- 3. Assert results
SELECT results_eq(
    $$
    SELECT mentee_count FROM public.get_mentorship_cohort_analysis();
    $$,
    ARRAY[1],
    'Mentee cohort count should be 1'
);

SELECT results_eq(
    $$
    SELECT non_mentee_count FROM public.get_mentorship_cohort_analysis();
    $$,
    ARRAY[1],
    'Control cohort count should be 1'
);

SELECT results_eq(
    $$
    SELECT mentee_avg_points_delta FROM public.get_mentorship_cohort_analysis();
    $$,
    ARRAY[150.00::numeric],
    'Mentee points delta should be 150.00'
);

SELECT results_eq(
    $$
    SELECT non_mentee_avg_points_delta FROM public.get_mentorship_cohort_analysis();
    $$,
    ARRAY[50.00::numeric],
    'Control points delta should be 50.00'
);

SELECT results_eq(
    $$
    SELECT mentee_exec_role_ratio FROM public.get_mentorship_cohort_analysis();
    $$,
    ARRAY[100.00::numeric],
    'Mentee executive placement ratio should be 100.0%'
);

ROLLBACK;
