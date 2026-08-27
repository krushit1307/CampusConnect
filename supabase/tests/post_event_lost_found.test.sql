-- ============================================================
-- Test Suite: post_event_lost_found.test.sql
-- Description: Verifies post-event lost & found scraping, temporal filters, and attendee outbox logging.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(6);

-- 1. Check schema components
SELECT has_column('public', 'events', 'lost_found_scraped', 'events table should have lost_found_scraped column');
SELECT has_function('public', 'scrape_post_event_lost_found', 'scrape_post_event_lost_found function should exist');

-- 2. Mock users, club, event, RSVPs, and found items
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000aa1', 'attended-user@campus.edu'),
    ('00000000-0000-0000-0000-000000000aa2', 'no-show-user@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000aa1', 'John', 'Attendee', 'john_attendee', 'attended-user@campus.edu'),
    ('00000000-0000-0000-0000-000000000aa2', 'Bob', 'NoShow', 'bob_noshow', 'no-show-user@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000ac1',
    'Lost & Found Club',
    'lost-found-club',
    '00000000-0000-0000-0000-000000000aa1'
)
ON CONFLICT (id) DO NOTHING;

-- Event ended 25 hours ago
INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by, lost_found_scraped)
VALUES (
    '00000000-0000-0000-0000-000000000ae1',
    '00000000-0000-0000-0000-000000000ac1',
    'Big Gala Night',
    'published',
    now() - INTERVAL '30 hours',
    now() - INTERVAL '25 hours',
    '00000000-0000-0000-0000-000000000aa1',
    false
)
ON CONFLICT (id) DO NOTHING;

-- RSVPs
INSERT INTO public.event_rsvps (id, event_id, user_id, status)
VALUES
    ('00000000-0000-0000-0000-000000000ar1', '00000000-0000-0000-0000-000000000ae1', '00000000-0000-0000-0000-000000000aa1', 'attended'),
    ('00000000-0000-0000-0000-000000000ar2', '00000000-0000-0000-0000-000000000ae1', '00000000-0000-0000-0000-000000000aa2', 'no_show')
ON CONFLICT (id) DO NOTHING;

-- Found items linked to event
INSERT INTO public.lost_items (id, user_id, title, category, type, event_id, created_at)
VALUES
    ('00000000-0000-0000-0000-000000000ai1', '00000000-0000-0000-0000-000000000aa1', 'Leather Wallet', 'Wallet', 'found', '00000000-0000-0000-0000-000000000ae1', now() - INTERVAL '29 hours'),
    ('00000000-0000-0000-0000-000000000ai2', '00000000-0000-0000-0000-000000000aa1', 'Car Keys', 'Keys', 'found', '00000000-0000-0000-0000-000000000ae1', now() - INTERVAL '28 hours')
ON CONFLICT (id) DO NOTHING;

-- 3. Execute scrape function
SELECT lives_ok(
    $$
    SELECT public.scrape_post_event_lost_found();
    $$,
    'Execute post-event lost & found scraping function successfully'
);

-- Assert event marked as scraped
SELECT results_eq(
    $$
    SELECT lost_found_scraped FROM public.events WHERE id = '00000000-0000-0000-0000-000000000ae1';
    $$,
    ARRAY[TRUE],
    'Event should be marked as scraped'
);

-- Assert outbox events enqueued only for attendee
SELECT results_eq(
    $$
    SELECT count(*)::integer FROM public.outbox_events
    WHERE (payload->>'table') = 'lost_items' AND (payload->>'action') = 'POST_EVENT_LOST_FOUND';
    $$,
    ARRAY[1],
    'Exactly one outbox notification should be enqueued (for attended user)'
);

SELECT results_eq(
    $$
    SELECT payload->'record'->>'attendee_email' FROM public.outbox_events
    WHERE (payload->>'table') = 'lost_items' AND (payload->>'action') = 'POST_EVENT_LOST_FOUND';
    $$,
    ARRAY['attended-user@campus.edu'],
    'The outbox notification should target the attended user email'
);

ROLLBACK;
