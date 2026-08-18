-- ============================================================
-- Test Suite: automated_event_reminder_escalation.test.sql
-- Description: Verifies the scheduled_reminders queue, RSVP triggers, and cron schedulers.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(8);

-- 1. Verify schema elements exist on scheduled_reminders table
SELECT has_table('public', 'scheduled_reminders', 'scheduled_reminders table should exist');
SELECT has_column('public', 'scheduled_reminders', 'rsvp_id', 'scheduled_reminders table should have rsvp_id column');
SELECT has_column('public', 'scheduled_reminders', 'stage', 'scheduled_reminders table should have stage column');
SELECT has_column('public', 'scheduled_reminders', 'scheduled_for', 'scheduled_reminders table should have scheduled_for column');
SELECT has_column('public', 'scheduled_reminders', 'status', 'scheduled_reminders table should have status column');

-- 2. Verify pg_cron job is scheduled
SELECT results_eq(
    $$
    SELECT count(*)::integer FROM cron.job
    WHERE jobname = 'process-scheduled-reminders-cron';
    $$,
    ARRAY[1],
    'process-scheduled-reminders-cron job should be registered in cron.job'
);

-- 3. Set up mock users, profiles, club, event, and RSVP
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000e11', 'attendee-rem@campus.edu'),
    ('00000000-0000-0000-0000-000000000e12', 'creator-rem@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000e11', 'Bobby', 'Attendee', 'bobby_attendee', 'attendee-rem@campus.edu'),
    ('00000000-0000-0000-0000-000000000e12', 'Sarah', 'Creator', 'sarah_creator', 'creator-rem@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000ec1',
    'Drama Club',
    'drama-club',
    '00000000-0000-0000-0000-000000000e12'
)
ON CONFLICT (id) DO NOTHING;

-- Event starts in 5 days
INSERT INTO public.events (id, club_id, title, description, start_time, max_attendees, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000ee1',
    '00000000-0000-0000-0000-000000000ec1',
    'Annual Play',
    'Join our amazing drama play.',
    now() + INTERVAL '5 days',
    100,
    '00000000-0000-0000-0000-000000000e12'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Test RSVP insert triggers scheduling
INSERT INTO public.event_rsvps (id, event_id, user_id, status)
VALUES (
    '00000000-0000-0000-0000-000000000er1',
    '00000000-0000-0000-0000-000000000ee1',
    '00000000-0000-0000-0000-000000000e11',
    'attending'
)
ON CONFLICT (id) DO NOTHING;

SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.scheduled_reminders
    WHERE rsvp_id = '00000000-0000-0000-0000-000000000er1' AND status = 'pending';
    $$,
    ARRAY[3],
    'Inserting an RSVP as attending should schedule 3 reminder stages in pending status'
);

-- 5. Test cancelling RSVP cleans up scheduled reminders
UPDATE public.event_rsvps
SET status = 'cancelled'
WHERE id = '00000000-0000-0000-0000-000000000er1';

SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.scheduled_reminders
    WHERE rsvp_id = '00000000-0000-0000-0000-000000000er1';
    $$,
    ARRAY[0],
    'Setting RSVP status to cancelled should instantly delete all pending scheduled reminders'
);

ROLLBACK;
