-- ============================================================
-- Test Suite: underdog_catchup_engine.test.sql
-- Description: Verifies the Underdog Catch-Up Engine:
--   * Schema and RLS on underdog_bounties
--   * Bounty auto-generation for bottom 10% clubs
--   * Trigger-based quest progress and reward claiming
--   * Rank-based points multiplier calculations and bypass rules
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(22);

-- ============================================================
-- 1. Schema validation
-- ============================================================
SELECT has_table('public', 'underdog_bounties', 'underdog_bounties table should exist');

SELECT has_column('public', 'underdog_bounties', 'id',               'underdog_bounties should have id column');
SELECT has_column('public', 'underdog_bounties', 'club_id',          'underdog_bounties should have club_id column');
SELECT has_column('public', 'underdog_bounties', 'target_checkins',  'underdog_bounties should have target_checkins column');
SELECT has_column('public', 'underdog_bounties', 'current_checkins', 'underdog_bounties should have current_checkins column');
SELECT has_column('public', 'underdog_bounties', 'reward_points',    'underdog_bounties should have reward_points column');
SELECT has_column('public', 'underdog_bounties', 'expires_at',       'underdog_bounties should have expires_at column');
SELECT has_column('public', 'underdog_bounties', 'claimed_at',       'underdog_bounties should have claimed_at column');

SELECT has_function('public', 'generate_underdog_bounties',       'generate_underdog_bounties() function should exist');
SELECT has_function('public', 'progress_underdog_bounty',         'progress_underdog_bounty() trigger function should exist');
SELECT has_function('public', 'apply_underdog_multiplier_on_points', 'apply_underdog_multiplier_on_points() trigger function should exist');
SELECT has_function('public', 'get_user_underdog_multiplier', ARRAY['uuid'], 'get_user_underdog_multiplier(uuid) RPC should exist');

-- ============================================================
-- 2. RLS Policy validation
-- ============================================================
SELECT policies_are(
    'public',
    'underdog_bounties',
    ARRAY[
        'underdog_bounties_select_authenticated',
        'underdog_bounties_insert_service',
        'underdog_bounties_update_service'
    ],
    'underdog_bounties should have exactly the three expected RLS policies'
);

-- ============================================================
-- 3. Mock data setup
-- ============================================================

-- Auth users
INSERT INTO auth.users (id, email)
VALUES
    ('bbbbbbbb-0000-0000-0000-000000000001', 'underdog_member1@campus.edu'),
    ('bbbbbbbb-0000-0000-0000-000000000002', 'underdog_member2@campus.edu'),
    ('bbbbbbbb-0000-0000-0000-000000000003', 'topclub_member@campus.edu')
ON CONFLICT (id) DO NOTHING;

-- Profiles
INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('bbbbbbbb-0000-0000-0000-000000000001', 'Alice', 'Underdog', 'alice_underdog', 'underdog_member1@campus.edu'),
    ('bbbbbbbb-0000-0000-0000-000000000002', 'Bob',   'Underdog', 'bob_underdog',   'underdog_member2@campus.edu'),
    ('bbbbbbbb-0000-0000-0000-000000000003', 'Carol', 'TopClub',  'carol_top',      'topclub_member@campus.edu')
ON CONFLICT (id) DO NOTHING;

-- Clubs (one bottom-rank club, one top-rank club)
INSERT INTO public.clubs (id, name, slug, status, created_by)
VALUES
    ('cccccccc-0000-0000-0000-000000000001', 'Tiny Underdog Club', 'tiny-underdog-club', 'ACTIVE', 'bbbbbbbb-0000-0000-0000-000000000001'),
    ('cccccccc-0000-0000-0000-000000000002', 'Mega Top Club',      'mega-top-club',      'ACTIVE', 'bbbbbbbb-0000-0000-0000-000000000003')
ON CONFLICT (id) DO NOTHING;

-- Club members
INSERT INTO public.club_members (club_id, user_id, status)
VALUES
    ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'approved'),
    ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'approved'),
    ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000003', 'approved')
ON CONFLICT DO NOTHING;

-- Seed club_leaderboard_scores materialized view by inserting test rows directly
-- (We cannot REFRESH concurrently in a transaction, so we bypass via DELETE+INSERT
--  on the underlying materialized view storage using a workaround INSERT hack.
--  In practice the migration refresh_leaderboard() is called; here we just need
--  representative rows present so functions can read them.)
DELETE FROM public.club_leaderboard_scores WHERE club_id IN (
    'cccccccc-0000-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000002'
);
-- Tiny Underdog Club: very low score (will be in bottom 10%)
INSERT INTO public.club_leaderboard_scores
    (club_id, club_name, logo_url, slug, valid_events_hosted, unique_attendees, total_members, avg_feedback_score, total_score)
VALUES
    ('cccccccc-0000-0000-0000-000000000001', 'Tiny Underdog Club', NULL, 'tiny-underdog-club', 0, 0, 2, 0, 5);
-- Mega Top Club: very high score (will be in top 10%)
INSERT INTO public.club_leaderboard_scores
    (club_id, club_name, logo_url, slug, valid_events_hosted, unique_attendees, total_members, avg_feedback_score, total_score)
VALUES
    ('cccccccc-0000-0000-0000-000000000002', 'Mega Top Club', NULL, 'mega-top-club', 50, 500, 300, 4.9, 9999);

-- Event for the underdog club
INSERT INTO public.events (id, club_id, title, start_date, end_date, status, created_by)
VALUES (
    'dddddddd-0000-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000001',
    'Underdog Kickoff Event',
    NOW() - INTERVAL '1 hour',
    NOW() + INTERVAL '1 hour',
    'published',
    'bbbbbbbb-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Test: generate_underdog_bounties() creates bounties for bottom 10% clubs
-- ============================================================

-- Run as service_role to bypass RLS
SET LOCAL ROLE service_role;
SELECT public.generate_underdog_bounties();
RESET ROLE;

SELECT is(
    (SELECT COUNT(*)::INTEGER FROM public.underdog_bounties
     WHERE club_id = 'cccccccc-0000-0000-0000-000000000001'
       AND claimed_at IS NULL
       AND expires_at > NOW()),
    1,
    'Underdog club should have exactly 1 active bounty after generate_underdog_bounties()'
);

SELECT is(
    (SELECT COUNT(*)::INTEGER FROM public.underdog_bounties
     WHERE club_id = 'cccccccc-0000-0000-0000-000000000002'
       AND claimed_at IS NULL),
    0,
    'Top-ranked club should NOT have an underdog bounty'
);

-- Idempotency: calling again should not create a duplicate
SET LOCAL ROLE service_role;
SELECT public.generate_underdog_bounties();
RESET ROLE;

SELECT is(
    (SELECT COUNT(*)::INTEGER FROM public.underdog_bounties
     WHERE club_id = 'cccccccc-0000-0000-0000-000000000001'
       AND claimed_at IS NULL),
    1,
    'generate_underdog_bounties() should be idempotent (no duplicate active bounties)'
);

-- ============================================================
-- 5. Test: progress_underdog_bounty() trigger increments progress on check-in
-- ============================================================

-- Manually set a low target (2) so we can test claiming in this transaction
UPDATE public.underdog_bounties
SET target_checkins = 2
WHERE club_id = 'cccccccc-0000-0000-0000-000000000001'
  AND claimed_at IS NULL;

-- First check-in (progress: 0 -> 1, not yet claimed)
INSERT INTO public.event_rsvps (event_id, user_id, checked_in)
VALUES ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', TRUE);

SELECT is(
    (SELECT current_checkins FROM public.underdog_bounties
     WHERE club_id    = 'cccccccc-0000-0000-0000-000000000001'
       AND claimed_at IS NULL),
    1,
    'First check-in should increment bounty current_checkins to 1'
);

SELECT is(
    (SELECT claimed_at FROM public.underdog_bounties
     WHERE club_id = 'cccccccc-0000-0000-0000-000000000001'
     LIMIT 1),
    NULL,
    'Bounty should NOT be claimed after the first check-in (target=2)'
);

-- Second check-in completes the bounty (progress: 1 -> 2, target met -> claimed)
INSERT INTO public.event_rsvps (event_id, user_id, checked_in)
VALUES ('dddddddd-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', TRUE);

SELECT isnt(
    (SELECT claimed_at FROM public.underdog_bounties
     WHERE club_id = 'cccccccc-0000-0000-0000-000000000001'
     LIMIT 1),
    NULL,
    'Bounty should be claimed after the target number of check-ins is reached'
);

-- Both club members should have received reward_points in points_ledger
SELECT is(
    (SELECT COUNT(*)::INTEGER FROM public.points_ledger
     WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000001'
       AND reason  LIKE '%Underdog Bounty Claimed%'),
    1,
    'Member 1 should have received a bounty reward in points_ledger'
);

SELECT is(
    (SELECT COUNT(*)::INTEGER FROM public.points_ledger
     WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
       AND reason  LIKE '%Underdog Bounty Claimed%'),
    1,
    'Member 2 should have received a bounty reward in points_ledger'
);

-- ============================================================
-- 6. Test: rank-based multiplier via get_user_underdog_multiplier()
-- ============================================================

-- Underdog member: club is in bottom 10% -> expect x2.0
SELECT is(
    public.get_user_underdog_multiplier('bbbbbbbb-0000-0000-0000-000000000001'),
    2.0,
    'Member of bottom-10% club should get a 2.0x multiplier'
);

-- Top club member: club is in top 50% -> expect x1.0
SELECT is(
    public.get_user_underdog_multiplier('bbbbbbbb-0000-0000-0000-000000000003'),
    1.0,
    'Member of top-50% club should get no boost (1.0x multiplier)'
);

-- User with no club membership -> expect x1.0
SELECT is(
    public.get_user_underdog_multiplier(gen_random_uuid()),
    1.0,
    'User with no club membership should get no boost (1.0x multiplier)'
);

-- ============================================================
-- 7. Test: apply_underdog_multiplier_on_points trigger
-- ============================================================

-- Insert a standard point earn for the underdog member
INSERT INTO public.points_ledger (user_id, amount, reason)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 100, 'Test point earn for underdog member');

-- Amount should be doubled (100 * 2.0 = 200)
SELECT is(
    (SELECT amount FROM public.points_ledger
     WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000001'
       AND reason  = 'Test point earn for underdog member'),
    200,
    'Underdog member points_ledger insert should be multiplied by 2.0 (100 -> 200)'
);

-- Bounty-reward inserts must NOT be re-amplified (bypass check)
INSERT INTO public.points_ledger (user_id, amount, reason)
VALUES ('bbbbbbbb-0000-0000-0000-000000000001', 200, 'Underdog Bounty Claimed - Club Catch-Up Reward');

SELECT is(
    (SELECT amount FROM public.points_ledger
     WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000001'
       AND reason LIKE '%Underdog Bounty Claimed%'
     ORDER BY created_at DESC
     LIMIT 1),
    200,
    'Bounty reward inserts should bypass the multiplier (no recursive amplification)'
);

ROLLBACK;
