-- ============================================================
-- Test Suite: event_photo_bounties.test.sql
-- Description: Verifies 'Automated "Missing Photo" Bounties' (#4531).
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(15);

-- 1. Check Tables and Columns
SELECT has_column('public', 'events', 'photo_status', 'events table should have photo_status');
SELECT has_column('public', 'events', 'photo_status_updated_at', 'events table should have photo_status_updated_at');

SELECT has_table('public', 'event_photo_bounty_winners', 'event_photo_bounty_winners table should exist');
SELECT has_column('public', 'event_photo_bounty_winners', 'event_id', 'event_photo_bounty_winners should have event_id');
SELECT has_column('public', 'event_photo_bounty_winners', 'user_id', 'event_photo_bounty_winners should have user_id');

-- 2. Mock Setup
-- Profiles
INSERT INTO public.profiles (id, full_name, role, gamification_points)
VALUES 
    ('88888888-8888-8888-8888-888888888801', 'Attendee One',   'student', 0),
    ('88888888-8888-8888-8888-888888888802', 'Attendee Two',   'student', 0),
    ('88888888-8888-8888-8888-888888888803', 'Attendee Three', 'student', 0),
    ('88888888-8888-8888-8888-888888888804', 'Attendee Four',  'student', 0)
ON CONFLICT (id) DO NOTHING;

-- Clubs
INSERT INTO public.clubs (id, name, slug)
VALUES ('88888888-8888-8888-8888-aaaaaaaaaaaa', 'Photography Club', 'photography-club')
ON CONFLICT (id) DO NOTHING;

-- Events
INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, start_date, end_date, status, photo_status)
VALUES 
    ('88888888-8888-8888-8888-eeeeeeeeee01', '88888888-8888-8888-8888-aaaaaaaaaaaa', 'Stale Event', 10, 10, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days', 'completed', 'Escalated'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-aaaaaaaaaaaa', 'Active Event', 10, 10, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 'completed', 'Bounty_Active')
ON CONFLICT (id) DO NOTHING;

-- Set photo_status_updated_at manually to simulate time elapsed
UPDATE public.events
SET photo_status_updated_at = NOW() - INTERVAL '8 days'
WHERE id = '88888888-8888-8888-8888-eeeeeeeeee01';

-- Attendee RSVPs and check-ins
INSERT INTO public.event_rsvps (id, event_id, user_id, status, checked_in)
VALUES
    ('88888888-8888-8888-8888-bbbbbbbbbb01', '88888888-8888-8888-8888-eeeeeeeeee01', '88888888-8888-8888-8888-888888888801', 'attending', TRUE),
    ('88888888-8888-8888-8888-bbbbbbbbbb02', '88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888801', 'attending', TRUE),
    ('88888888-8888-8888-8888-bbbbbbbbbb03', '88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888802', 'attending', TRUE),
    ('88888888-8888-8888-8888-bbbbbbbbbb04', '88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888803', 'attending', TRUE),
    ('88888888-8888-8888-8888-bbbbbbbbbb05', '88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888804', 'attending', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. Test Escalation Trigger
SELECT results_eq(
    $$ SELECT photo_status FROM public.events WHERE id = '88888888-8888-8888-8888-eeeeeeeeee01' $$,
    $$ VALUES ('Escalated'::varchar) $$,
    'Initially photo status is Escalated'
);

-- Execute check function to activate stale bounties
SELECT lives_ok(
    $$ SELECT public.check_and_activate_photo_bounties() $$,
    'check_and_activate_photo_bounties should run without error'
);

-- Confirm it transitioned status to Bounty_Active
SELECT results_eq(
    $$ SELECT photo_status FROM public.events WHERE id = '88888888-8888-8888-8888-eeeeeeeeee01' $$,
    $$ VALUES ('Bounty_Active'::varchar) $$,
    'Stale Escalated event should transition to Bounty_Active'
);

-- Confirm notifications were generated for the attendee
SELECT is(
    (SELECT count(*)::int FROM public.notifications 
     WHERE user_id = '88888888-8888-8888-8888-888888888801' 
       AND title = 'Photo Bounty Active!'),
    1,
    'Verified attendees should receive a bounty active notification'
);

-- 4. Test Bounty Submissions and Scoring
-- User 1 uploads 4 photos (not enough for bounty)
INSERT INTO public.event_photos (event_id, user_id, url)
VALUES
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888801', 'http://example.com/p1'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888801', 'http://example.com/p2'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888801', 'http://example.com/p3'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888801', 'http://example.com/p4');

-- User 1 should have no points awarded yet
SELECT results_eq(
    $$ SELECT gamification_points FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888801' $$,
    $$ VALUES (0) $$,
    'User should have 0 points before uploading 5th photo'
);

-- User 1 uploads the 5th photo
INSERT INTO public.event_photos (event_id, user_id, url)
VALUES ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888801', 'http://example.com/p5');

-- User 1 should now be rewarded with 500 points
SELECT results_eq(
    $$ SELECT gamification_points FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888801' $$,
    $$ VALUES (500) $$,
    'User 1 should be awarded 500 points after uploading 5 photos'
);

-- User 1 should be listed in the bounty winners
SELECT ok(
    EXISTS (SELECT 1 FROM public.event_photo_bounty_winners WHERE event_id = '88888888-8888-8888-8888-eeeeeeeeee02' AND user_id = '88888888-8888-8888-8888-888888888801'),
    'User 1 should be listed as a winner'
);

-- User 2 uploads 5 photos
INSERT INTO public.event_photos (event_id, user_id, url)
VALUES
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888802', 'http://example.com/2p1'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888802', 'http://example.com/2p2'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888802', 'http://example.com/2p3'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888802', 'http://example.com/2p4'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888802', 'http://example.com/2p5');

SELECT results_eq(
    $$ SELECT gamification_points FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888802' $$,
    $$ VALUES (500) $$,
    'User 2 should be awarded 500 points'
);

-- User 3 uploads 5 photos (third winner, should trigger Completed status)
INSERT INTO public.event_photos (event_id, user_id, url)
VALUES
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888803', 'http://example.com/3p1'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888803', 'http://example.com/3p2'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888803', 'http://example.com/3p3'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888803', 'http://example.com/3p4'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888803', 'http://example.com/3p5');

SELECT results_eq(
    $$ SELECT gamification_points FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888803' $$,
    $$ VALUES (500) $$,
    'User 3 should be awarded 500 points'
);

-- Verify event status is updated to Completed
SELECT results_eq(
    $$ SELECT photo_status FROM public.events WHERE id = '88888888-8888-8888-8888-eeeeeeeeee02' $$,
    $$ VALUES ('Completed'::varchar) $$,
    'Event photo status should transition to Completed'
);

-- User 4 uploads 5 photos (bounty already closed, should NOT get points or be winner)
INSERT INTO public.event_photos (event_id, user_id, url)
VALUES
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888804', 'http://example.com/4p1'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888804', 'http://example.com/4p2'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888804', 'http://example.com/4p3'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888804', 'http://example.com/4p4'),
    ('88888888-8888-8888-8888-eeeeeeeeee02', '88888888-8888-8888-8888-888888888804', 'http://example.com/4p5');

SELECT results_eq(
    $$ SELECT gamification_points FROM public.profiles WHERE id = '88888888-8888-8888-8888-888888888804' $$,
    $$ VALUES (0) $$,
    'User 4 should not receive points as the bounty is closed'
);

SELECT is(
    (SELECT count(*)::int FROM public.event_photo_bounty_winners WHERE event_id = '88888888-8888-8888-8888-eeeeeeeeee02'),
    3,
    'There should remain exactly 3 winners registered for the bounty'
);

ROLLBACK;
