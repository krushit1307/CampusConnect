-- ============================================================
-- Test Suite: automated_member_birthday_shoutout.test.sql
-- Description: Verifies the user_private_details table, strict privacy policies, and pg_cron scheduler.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(10);

-- 1. Verify schema elements exist on user_private_details table
SELECT has_table('public', 'user_private_details', 'user_private_details table should exist');
SELECT has_column('public', 'user_private_details', 'user_id', 'user_private_details table should have user_id column');
SELECT has_column('public', 'user_private_details', 'birth_date', 'user_private_details table should have birth_date column');
SELECT has_column('public', 'user_private_details', 'share_birthday', 'user_private_details table should have share_birthday column');

-- 2. Verify auto_post_birthdays column exists on clubs table
SELECT has_column('public', 'clubs', 'auto_post_birthdays', 'clubs table should have auto_post_birthdays column');

-- 3. Verify pg_cron job is scheduled
SELECT results_eq(
    $$
    SELECT count(*)::integer FROM cron.job
    WHERE jobname = 'member-birthday-shoutout-cron';
    $$,
    ARRAY[1],
    'member-birthday-shoutout-cron job should be registered in cron.job'
);

-- 4. Set up mock users, profiles, club, and membership
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000b11', 'birthday-boy@campus.edu'),
    ('00000000-0000-0000-0000-000000000b12', 'other-student@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000b11', 'Bobby', 'Birthday', 'bobby_bday', 'birthday-boy@campus.edu'),
    ('00000000-0000-0000-0000-000000000b12', 'Sarah', 'Student', 'sarah_student', 'other-student@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by, auto_post_birthdays)
VALUES (
    '00000000-0000-0000-0000-000000000bc1',
    'Cake Club',
    'cake-club',
    '00000000-0000-0000-0000-000000000b12',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.club_members (id, club_id, user_id, role, status)
VALUES
    ('00000000-0000-0000-0000-000000000bm1', '00000000-0000-0000-0000-000000000bc1', '00000000-0000-0000-0000-000000000b11', 'member', 'approved')
ON CONFLICT (id) DO NOTHING;

-- Insert birthday exactly 3 days from now
INSERT INTO public.user_private_details (user_id, birth_date, share_birthday)
VALUES (
    '00000000-0000-0000-0000-000000000b11',
    (now() + INTERVAL '3 days')::date - INTERVAL '20 years', -- 20 years ago, month & day matches
    TRUE
)
ON CONFLICT (user_id) DO NOTHING;

-- 5. Test RPC returns upcoming birthdays
SELECT results_eq(
    $$
    SELECT user_id, first_name, last_name, club_id, auto_post_birthdays FROM public.get_upcoming_member_birthdays();
    $$,
    $$
    VALUES (
        '00000000-0000-0000-0000-000000000b11'::uuid,
        'Bobby'::text,
        'Birthday'::text,
        '00000000-0000-0000-0000-000000000bc1'::uuid,
        TRUE
    );
    $$,
    'get_upcoming_member_birthdays() should return Bobby Birthday since his birthday is in 3 days'
);

-- 6. Verify strict RLS policies on user_private_details
-- Bobby should be able to view his own details
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000b11';

SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.user_private_details WHERE user_id = '00000000-0000-0000-0000-000000000b11';
    $$,
    ARRAY[1],
    ' Bobby should be able to see his own private details'
);

-- Sarah should NOT be able to view Bobby's details
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000b12';

SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.user_private_details WHERE user_id = '00000000-0000-0000-0000-000000000b11';
    $$,
    ARRAY[0],
    ' Sarah should NOT be able to see Bobby private details (strict privacy controls)'
);

-- Sarah should NOT be able to update Bobby's details
SELECT throws_ok(
    $$
    UPDATE public.user_private_details
    SET birth_date = '2000-01-01'
    WHERE user_id = '00000000-0000-0000-0000-000000000b11';
    $$,
    'Sarah trying to update Bobby details should fail or do nothing'
);

ROLLBACK;
