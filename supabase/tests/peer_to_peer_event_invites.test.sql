-- ============================================================
-- Test Suite: peer_to_peer_event_invites.test.sql
-- Description: Verifies referrals schema, self-referral checks, points allocation triggers, and promoters RPC.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(8);

-- 1. Verify schema elements exist on event_referrals table
SELECT has_table('public', 'event_referrals', 'event_referrals table should exist');
SELECT has_column('public', 'event_referrals', 'referrer_user_id', 'event_referrals table should have referrer_user_id column');
SELECT has_column('public', 'event_referrals', 'referred_user_id', 'event_referrals table should have referred_user_id column');
SELECT has_column('public', 'event_referrals', 'event_id', 'event_referrals table should have event_id column');

-- 2. Set up mock users, profiles, club, and event
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000f11', 'referrer@campus.edu'),
    ('00000000-0000-0000-0000-000000000f12', 'referred@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000f11', 'Rob', 'Referrer', 'rob_ref', 'referrer@campus.edu'),
    ('00000000-0000-0000-0000-000000000f12', 'Sarah', 'Referred', 'sarah_ref', 'referred@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000fc1',
    'Drama Club',
    'drama-club',
    '00000000-0000-0000-0000-000000000f11'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, description, start_time, max_attendees, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000fe1',
    '00000000-0000-0000-0000-000000000fc1',
    'Annual Play',
    'Join our amazing drama play.',
    now() + INTERVAL '5 days',
    100,
    '00000000-0000-0000-0000-000000000f11'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Assert self-referrals are prevented
SELECT throws_ok(
    $$
    INSERT INTO public.event_referrals (referrer_user_id, referred_user_id, event_id)
    VALUES (
        '00000000-0000-0000-0000-000000000f11',
        '00000000-0000-0000-0000-000000000f11',
        '00000000-0000-0000-0000-000000000fe1'
    );
    $$,
    'new row for relation "event_referrals" violates check constraint "self_referral_check"',
    'Self-referrals must throw a constraint error'
);

-- 4. Test trigger awards points upon attending RSVP
INSERT INTO public.event_rsvps (event_id, user_id, status, referred_by)
VALUES (
    '00000000-0000-0000-0000-000000000fe1',
    '00000000-0000-0000-0000-000000000f12',
    'attending',
    '00000000-0000-0000-0000-000000000f11'
);

-- Check that a referral log was created
SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.event_referrals
    WHERE referrer_user_id = '00000000-0000-0000-0000-000000000f11'
      AND referred_user_id = '00000000-0000-0000-0000-000000000f12'
      AND event_id = '00000000-0000-0000-0000-000000000fe1';
    $$,
    ARRAY[1],
    'A referral log record must be automatically created by the trigger'
);

-- Check that both users were credited 50 points
SELECT results_eq(
    $$
    SELECT sum(amount)::integer FROM public.points_ledger
    WHERE user_id IN ('00000000-0000-0000-0000-000000000f11', '00000000-0000-0000-0000-000000000f12');
    $$,
    ARRAY[100],
    'Both the referrer and the referred user must be credited 50 points (total 100 points)'
);

-- 5. Test RPC promoters leaderboard returns Rob
SELECT results_eq(
    $$
    SELECT referrer_name, referral_count FROM public.get_event_top_promoters('00000000-0000-0000-0000-000000000fe1');
    $$,
    $$
    VALUES ('Rob Referrer'::text, 1::bigint);
    $$,
    'get_event_top_promoters RPC should return Rob Referrer with 1 invite count'
);

ROLLBACK;
