-- ============================================================
-- Test Suite: automated_streak_system.test.sql
-- Description: Verifies gamified weekly streak attendance, milestone multiplier point awards, and holiday freezes.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(15);

-- 1. Schema check
SELECT has_column('public', 'profiles', 'current_streak', 'profiles table should have current_streak column');
SELECT has_column('public', 'profiles', 'last_attended_week', 'profiles table should have last_attended_week column');

SELECT has_function('public', 'get_last_active_week', ARRAY['date'], 'get_last_active_week(date) function should exist');
SELECT has_function('public', 'handle_streak_on_checkin', 'handle_streak_on_checkin() function should exist');
SELECT has_function('public', 'evaluate_user_streaks', 'evaluate_user_streaks() function should exist');

-- 2. Mock Setup
INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES ('44444444-4444-4444-4444-444444444401', 'Streak', 'Student', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug)
VALUES ('44444444-4444-4444-4444-4444444444aa', 'Streak Test Club', 'streak-test-club')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, start_date, end_date, status)
VALUES 
    ('44444444-4444-4444-4444-4444444444b1', '44444444-4444-4444-4444-4444444444aa', 'Event One', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '1 hour', 'published'),
    ('44444444-4444-4444-4444-4444444444b2', '44444444-4444-4444-4444-4444444444aa', 'Event Two', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '1 hour', 'published')
ON CONFLICT (id) DO NOTHING;

-- 3. Test first check-in starts streak at 1 and awards 50 points
INSERT INTO public.event_rsvps (event_id, user_id, checked_in)
VALUES ('44444444-4444-4444-4444-4444444444b1', '44444444-4444-4444-4444-444444444401', TRUE);

SELECT is(
    (SELECT current_streak FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444401'),
    1,
    'First check-in should initialize streak to 1'
);

SELECT is(
    (SELECT last_attended_week FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444401'),
    DATE_TRUNC('week', NOW())::DATE,
    'First check-in last_attended_week should be Monday of current week'
);

SELECT is(
    (SELECT balance FROM public.user_wallets WHERE user_id = '44444444-4444-4444-4444-444444444401'),
    50,
    'First check-in should award base 50 ConnectCoins'
);

-- 4. Test double check-in in the same week keeps streak and points unchanged
INSERT INTO public.event_rsvps (event_id, user_id, checked_in)
VALUES ('44444444-4444-4444-4444-4444444444b2', '44444444-4444-4444-4444-444444444401', TRUE);

SELECT is(
    (SELECT current_streak FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444401'),
    1,
    'Double check-in in same week should keep streak at 1'
);

SELECT is(
    (SELECT balance FROM public.user_wallets WHERE user_id = '44444444-4444-4444-4444-444444444401'),
    50,
    'Double check-in in same week should not award extra points'
);

-- 5. Test milestone multipliers (5+ weeks: 100 points)
-- Manually force profile state to 4 weeks, last attended week as last week
UPDATE public.profiles
SET current_streak = 4,
    last_attended_week = DATE_TRUNC('week', NOW() - INTERVAL '1 week')::DATE
WHERE id = '44444444-4444-4444-4444-444444444401';

-- Clear existing RSVP and insert new one for this week's check-in
DELETE FROM public.event_rsvps WHERE user_id = '44444444-4444-4444-4444-444444444401';

INSERT INTO public.event_rsvps (event_id, user_id, checked_in)
VALUES ('44444444-4444-4444-4444-4444444444b1', '44444444-4444-4444-4444-444444444401', TRUE);

SELECT is(
    (SELECT current_streak FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444401'),
    5,
    'Check-in continuing streak to week 5 should increment streak to 5'
);

SELECT is(
    (SELECT balance FROM public.user_wallets WHERE user_id = '44444444-4444-4444-4444-444444444401'),
    150, -- 50 (from first checkin) + 100 (from 5-week checkin)
    'Reaching 5-week streak milestone should award 100 ConnectCoins (2x multiplier)'
);

-- 6. Test milestone multipliers (10+ weeks: 150 points)
UPDATE public.profiles
SET current_streak = 9,
    last_attended_week = DATE_TRUNC('week', NOW() - INTERVAL '1 week')::DATE
WHERE id = '44444444-4444-4444-4444-444444444401';

DELETE FROM public.event_rsvps WHERE user_id = '44444444-4444-4444-4444-444444444401';

INSERT INTO public.event_rsvps (event_id, user_id, checked_in)
VALUES ('44444444-4444-4444-4444-4444444444b1', '44444444-4444-4444-4444-444444444401', TRUE);

SELECT is(
    (SELECT current_streak FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444401'),
    10,
    'Check-in continuing streak to week 10 should increment streak to 10'
);

SELECT is(
    (SELECT balance FROM public.user_wallets WHERE user_id = '44444444-4444-4444-4444-444444444401'),
    300, -- 150 (previous) + 150 (from 10-week checkin)
    'Reaching 10-week streak milestone should award 150 ConnectCoins (3x multiplier)'
);

-- 7. Test Holiday Freeze
-- Setup academic calendar year and a holiday closure for this week
INSERT INTO public.academic_years (id, name, starts_on, ends_on, time_zone, is_current)
VALUES ('44444444-4444-4444-4444-4444444444bb', '2026-2027 Academic Year', NOW()::DATE - INTERVAL '100 days', NOW()::DATE + INTERVAL '100 days', 'UTC', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.academic_calendar_periods (id, academic_year_id, name, period_type, start_date, end_date)
VALUES (
    '44444444-4444-4444-4444-4444444444cc', 
    '44444444-4444-4444-4444-4444444444bb', 
    'Winter Break Closure', 
    'HOLIDAY', 
    DATE_TRUNC('week', NOW())::DATE, 
    (DATE_TRUNC('week', NOW()) + INTERVAL '6 days')::DATE
)
ON CONFLICT (id) DO NOTHING;

-- Force profile to last week and streak of 5
UPDATE public.profiles
SET current_streak = 5,
    last_attended_week = DATE_TRUNC('week', NOW() - INTERVAL '1 week')::DATE
WHERE id = '44444444-4444-4444-4444-444444444401';

-- Run evaluator job
SELECT public.evaluate_user_streaks();

SELECT is(
    (SELECT current_streak FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444401'),
    5,
    'Streak should remain frozen during holiday/closure weeks'
);

-- 8. Test Non-Holiday Reset
-- Remove holiday
DELETE FROM public.academic_calendar_periods WHERE id = '44444444-4444-4444-4444-4444444444cc';

-- Run evaluator job
SELECT public.evaluate_user_streaks();

SELECT is(
    (SELECT current_streak FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444401'),
    0,
    'Streak should be reset to 0 in active non-holiday weeks if the user did not attend'
);

ROLLBACK;
