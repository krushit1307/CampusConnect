-- supabase/tests/waitlist_promotion.test.sql
-- pgTAP test for the waitlist auto-promotion trigger.
--
-- Run with: psql -f supabase/tests/waitlist_promotion.test.sql
-- (after `npm run db:reset` to apply the migration)

\set ECHO none
BEGIN;
SELECT plan(8);

-- ── Setup: create a test club, event with capacity 2, and 3 users ──
INSERT INTO public.profiles (id, email, first_name, last_name)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'u1@test.local', 'User', 'One'),
    ('22222222-2222-2222-2222-222222222222', 'u2@test.local', 'User', 'Two'),
    ('33333333-3333-3333-3333-333333333333', 'u3@test.local', 'User', 'Three')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Club', 'test-club', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, event_date, max_attendees)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Waitlist Test Event',
    NOW() + INTERVAL '7 days',
    2  -- capacity = 2
)
ON CONFLICT (id) DO NOTHING;

-- ── Test 1: First user joins as attending ──────────────────────
SELECT is(
    (SELECT (public.join_event_or_waitlist(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '11111111-1111-1111-1111-111111111111'
    ) ->> 'status')),
    'attending',
    'First user should be attending'
);

-- ── Test 2: Second user joins as attending ──────────────────────
SELECT is(
    (SELECT (public.join_event_or_waitlist(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '22222222-2222-2222-2222-222222222222'
    ) ->> 'status')),
    'attending',
    'Second user should be attending (capacity 2 reached)'
);

-- ── Test 3: Third user joins as waitlisted ──────────────────────
SELECT is(
    (SELECT (public.join_event_or_waitlist(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '33333333-3333-3333-3333-333333333333'
    ) ->> 'status')),
    'waitlisted',
    'Third user should be waitlisted (capacity full)'
);

-- ── Test 4: get_event_rsvp_state reports is_full and waitlist count ──
SELECT is(
    (SELECT (public.get_event_rsvp_state(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        NULL
    ) ->> 'is_full')),
    'true',
    'Event should be full'
);
SELECT is(
    (SELECT (public.get_event_rsvp_state(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        NULL
    ) ->> 'waitlist_count')),
    '1',
    'Waitlist count should be 1'
);

-- ── Test 5: First user cancels → third user auto-promoted ───────
SELECT public.cancel_event_rsvp(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111'
);

SELECT is(
    (SELECT status FROM public.event_rsvps
     WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
       AND user_id = '33333333-3333-3333-3333-333333333333'),
    'attending',
    'Third user should have been auto-promoted to attending'
);

-- ── Test 6: Second user is still attending ───────────────────────
SELECT is(
    (SELECT status FROM public.event_rsvps
     WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
       AND user_id = '22222222-2222-2222-2222-222222222222'),
    'attending',
    'Second user should still be attending'
);

-- ── Cleanup ─────────────────────────────────────────────────────
DELETE FROM public.event_rsvps WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DELETE FROM public.events WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DELETE FROM public.clubs WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
DELETE FROM public.profiles WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333'
);

SELECT * FROM finish();
ROLLBACK;
