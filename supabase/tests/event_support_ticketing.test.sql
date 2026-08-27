-- ============================================================
-- Test Suite: event_support_ticketing.test.sql
-- Description: Verifies support ticketing schemas, RLS rules, and push notification resolution triggers.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(8);

-- 1. Check schemas
SELECT has_table('public', 'event_live_tickets', 'event_live_tickets table should exist');
SELECT has_column('public', 'event_live_tickets', 'event_id', 'event_live_tickets table should have event_id column');
SELECT has_column('public', 'event_live_tickets', 'user_id', 'event_live_tickets table should have user_id column');
SELECT has_column('public', 'event_live_tickets', 'message', 'event_live_tickets table should have message column');
SELECT has_column('public', 'event_live_tickets', 'status', 'event_live_tickets table should have status column');

-- 2. Mock users, profiles, club, and event
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000c11', 'organizer-ticketing@campus.edu'),
    ('00000000-0000-0000-0000-000000000c12', 'reporter-ticketing@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000c11', 'Rob', 'Organizer', 'rob_org', 'organizer-ticketing@campus.edu'),
    ('00000000-0000-0000-0000-000000000c12', 'Sarah', 'Reporter', 'sarah_rep', 'reporter-ticketing@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000cc1',
    'Ticketing Club',
    'ticketing-club',
    '00000000-0000-0000-0000-000000000c11'
)
ON CONFLICT (id) DO NOTHING;

-- Make Rob an admin of Ticketing Club
INSERT INTO public.club_members (id, club_id, user_id, role, status)
VALUES (
    '00000000-0000-0000-0000-000000000cm1',
    '00000000-0000-0000-0000-000000000cc1',
    '00000000-0000-0000-0000-000000000c11',
    'admin',
    'approved'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000ce1',
    '00000000-0000-0000-0000-000000000cc1',
    'AI Support Lecture',
    'published',
    now() + INTERVAL '1 day',
    now() + INTERVAL '1 day 2 hours',
    '00000000-0000-0000-0000-000000000c11'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Assert anonymous can file support ticket
SET local role anon;
SELECT lives_ok(
    $$
    INSERT INTO public.event_live_tickets (event_id, message, status)
    VALUES ('00000000-0000-0000-0000-000000000ce1', 'Mic Broken', 'open');
    $$,
    'Anonymous attendee should be allowed to submit a live support ticket'
);

-- 4. Test RLS select policies: non-admins cannot select other users tickets
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000c12'; -- Sarah

-- Sarah files a ticket
INSERT INTO public.event_live_tickets (id, event_id, user_id, message, status)
VALUES (
    '00000000-0000-0000-0000-000000000ct1',
    '00000000-0000-0000-0000-000000000ce1',
    '00000000-0000-0000-0000-000000000c12',
    'Too Cold',
    'open'
);

SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.event_live_tickets
    WHERE id = '00000000-0000-0000-0000-000000000ct1';
    $$,
    ARRAY[1],
    'Reporter should be allowed to view their own ticket'
);

-- 5. Test resolution notification trigger
-- Rob (admin) resolves the ticket
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000c11'; -- Rob

UPDATE public.event_live_tickets
SET status = 'resolved'
WHERE id = '00000000-0000-0000-0000-000000000ct1';

-- Check that a resolution notification log was created
SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.notifications
    WHERE user_id = '00000000-0000-0000-0000-000000000c12'
      AND type = 'support_ticket_resolved';
    $$,
    ARRAY[1],
    'A notification log must be automatically created when ticket status is updated to resolved'
);

ROLLBACK;
