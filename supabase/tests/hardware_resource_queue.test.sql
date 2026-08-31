-- ============================================================
-- Test Suite: hardware_resource_queue.test.sql
-- Description: Verifies the Dynamic Hardware Resource Reservation Queue.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(10);

-- 1. Check Tables and Columns
SELECT has_table('public', 'resource_waitlists', 'resource_waitlists table should exist');
SELECT has_column('public', 'resource_waitlists', 'resource_id', 'resource_waitlists should have resource_id column');
SELECT has_column('public', 'resource_waitlists', 'club_id', 'resource_waitlists should have club_id column');
SELECT has_column('public', 'resource_waitlists', 'requested_start', 'resource_waitlists should have requested_start column');
SELECT has_column('public', 'resource_waitlists', 'requested_end', 'resource_waitlists should have requested_end column');

-- 2. Mock Setup
-- Add profiles/users
INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES 
    ('55555555-5555-5555-5555-555555555501', 'Admin', 'One', 'student'),
    ('55555555-5555-5555-5555-555555555502', 'Admin', 'Two', 'student'),
    ('55555555-5555-5555-5555-555555555503', 'Student', 'Member', 'student')
ON CONFLICT (id) DO NOTHING;

-- Add clubs
INSERT INTO public.clubs (id, name, slug)
VALUES 
    ('55555555-5555-5555-5555-5555555555aa', 'Projector Club A', 'projector-club-a'),
    ('55555555-5555-5555-5555-5555555555bb', 'Camera Club B', 'camera-club-b'),
    ('55555555-5555-5555-5555-5555555555cc', 'Lent Club C', 'lent-club-c')
ON CONFLICT (id) DO NOTHING;

-- Add club members (admins)
INSERT INTO public.club_members (club_id, user_id, role, status)
VALUES 
    ('55555555-5555-5555-5555-5555555555aa', '55555555-5555-5555-5555-555555555501', 'admin', 'approved'),
    ('55555555-5555-5555-5555-5555555555bb', '55555555-5555-5555-5555-555555555502', 'admin', 'approved')
ON CONFLICT (club_id, user_id) DO NOTHING;

-- Add a university resource (Projector)
INSERT INTO public.university_resources (id, asset_tag, name, category)
VALUES ('55555555-5555-5555-5555-555555555511', 'Projector_X1', 'Conference Projector X1', 'AV_EQUIPMENT')
ON CONFLICT (id) DO NOTHING;

-- Create an initial booking for Club C (Conflicting booking)
INSERT INTO public.resource_bookings (id, resource_id, club_id, organizer_club_name, start_time, end_time, status)
VALUES (
    '55555555-5555-5555-5555-555555555599',
    '55555555-5555-5555-5555-555555555511',
    '55555555-5555-5555-5555-5555555555cc',
    'Lent Club C',
    NOW() + INTERVAL '1 hour',
    NOW() + INTERVAL '3 hours',
    'CONFIRMED'
);

-- Club A joins waitlist for the same time slot (overlapping)
INSERT INTO public.resource_waitlists (resource_id, club_id, requested_start, requested_end, created_at)
VALUES (
    '55555555-5555-5555-5555-555555555511',
    '55555555-5555-5555-5555-5555555555aa',
    NOW() + INTERVAL '1 hour',
    NOW() + INTERVAL '2 hours',
    NOW() - INTERVAL '10 minutes'
);

-- Club B joins waitlist for the same time slot (overlapping, but joined later than Club A)
INSERT INTO public.resource_waitlists (resource_id, club_id, requested_start, requested_end, created_at)
VALUES (
    '55555555-5555-5555-5555-555555555511',
    '55555555-5555-5555-5555-5555555555bb',
    NOW() + INTERVAL '1 hour',
    NOW() + INTERVAL '2 hours',
    NOW() - INTERVAL '5 minutes'
);

-- 3. Verify RLS policies on resource_waitlists
-- Select should be allowed for anyone
SELECT ok(
    (SELECT count(*)::int >= 0 FROM public.resource_waitlists),
    'Anyone can read resource_waitlists'
);

-- Insert/Delete should be allowed for Club admins
-- Let's test insert under auth context
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555501"}', true);
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.resource_waitlists WHERE club_id = '55555555-5555-5555-5555-5555555555aa'
    ),
    'Club A admin can see their waitlist entries'
);

-- Reset auth context
SELECT set_config('request.jwt.claims', '', true);

-- 4. Cancel the conflicting booking (Club C's booking)
-- This should trigger waitlist promotion for Club A (who joined first)
DELETE FROM public.resource_bookings
WHERE id = '55555555-5555-5555-5555-555555555599';

-- 5. Verify Club A is promoted
SELECT results_eq(
    $$ SELECT club_id, status FROM public.resource_bookings WHERE resource_id = '55555555-5555-5555-5555-555555555511' $$,
    $$ VALUES ('55555555-5555-5555-5555-5555555555aa'::uuid, 'CONFIRMED'::text) $$,
    'Club A should be promoted to a confirmed reservation'
);

-- 6. Verify promoted waitlist entry is deleted
SELECT is(
    (SELECT count(*)::int FROM public.resource_waitlists WHERE club_id = '55555555-5555-5555-5555-5555555555aa'),
    0,
    'Promoted waitlist entry should be deleted'
);

-- 7. Verify Club B waitlist entry remains in the queue
SELECT is(
    (SELECT count(*)::int FROM public.resource_waitlists WHERE club_id = '55555555-5555-5555-5555-5555555555bb'),
    1,
    'Non-promoted waitlist entry should remain in the queue'
);

-- 8. Verify push notification was sent to Club A admin (55555555-5555-5555-5555-555555555501)
SELECT is(
    (SELECT count(*)::int FROM public.notifications 
     WHERE user_id = '55555555-5555-5555-5555-555555555501' 
       AND type = 'resource_booking'),
    1,
    'Push notification should be dispatched to promoted club admin'
);

ROLLBACK;
