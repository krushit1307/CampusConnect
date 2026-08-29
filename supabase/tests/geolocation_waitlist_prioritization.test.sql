-- supabase/tests/geolocation_waitlist_prioritization.test.sql
-- pgTAP test for geolocation-based waitlist promotion (Issue #4679)
--
-- Run with: psql -f supabase/tests/geolocation_waitlist_prioritization.test.sql

\set ECHO none
BEGIN;
SELECT plan(12);

-- ── Setup: create test club, event, venue, and users ─────────────────
INSERT INTO public.profiles (id, email, first_name, last_name, latitude, longitude, last_location_updated_at)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'u1@test.local', 'User', 'One', 40.7128, -74.0060, NOW()),
    ('22222222-2222-2222-2222-222222222222', 'u2@test.local', 'User', 'Two', 40.7300, -74.0100, NOW()),
    ('33333333-3333-3333-3333-333333333333', 'u3@test.local', 'User', 'Three', 40.7500, -74.0500, NOW()),
    ('44444444-4444-4444-4444-444444444444', 'u4@test.local', 'User', 'Four', 40.7128, -74.0060, NOW() - INTERVAL '25 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Club', 'test-club', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- Create event starting in 45 minutes (imminent event)
INSERT INTO public.events (id, club_id, title, start_date, max_attendees, latitude, longitude)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Imminent Event',
    NOW() + INTERVAL '45 minutes',
    2,
    40.7128,
    -74.0060
)
ON CONFLICT (id) DO NOTHING;

-- Create venue for the event
INSERT INTO public.event_venues (event_id, venue_name, address, latitude, longitude)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Test Venue',
    '123 Test Street',
    40.7128,
    -74.0060
)
ON CONFLICT DO NOTHING;

-- ── Test 1: First user joins as attending ───────────────────────────────
SELECT is(
    (SELECT (public.join_event_or_waitlist(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '11111111-1111-1111-1111-111111111111'
    ) ->> 'status')),
    'attending',
    'First user should be attending'
);

-- ── Test 2: Second user joins as attending ───────────────────────────────
SELECT is(
    (SELECT (public.join_event_or_waitlist(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '22222222-2222-2222-2222-222222222222'
    ) ->> 'status')),
    'attending',
    'Second user should be attending (capacity 2 reached)'
);

-- ── Test 3: Third user joins as waitlisted ───────────────────────────────
SELECT is(
    (SELECT (public.join_event_or_waitlist(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '33333333-3333-3333-3333-333333333333'
    ) ->> 'status')),
    'waitlisted',
    'Third user should be waitlisted (capacity full)'
);

-- ── Test 4: Fourth user joins as waitlisted ───────────────────────────────
SELECT is(
    (SELECT (public.join_event_or_waitlist(
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '44444444-4444-4444-4444-444444444444'
    ) ->> 'status')),
    'waitlisted',
    'Fourth user should be waitlisted (capacity full)'
);

-- ── Test 5: User 4 has stale location (> 24 hours old) ───────────────────
SELECT is(
    (SELECT last_location_updated_at < NOW() - INTERVAL '24 hours' FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444444'),
    true,
    'User 4 should have stale location data'
);

-- ── Test 6: Request GPS ping for waitlist users ───────────────────────────
SELECT results_eq(
    $$
    SELECT user_id, needs_location_update
    FROM public.request_gps_ping_for_waitlist('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID)
    ORDER BY user_id
    $$,
    $$
    VALUES 
        ('33333333-3333-3333-3333-333333333333'::UUID, false),
        ('44444444-4444-4444-4444-444444444444'::UUID, true)
    $$,
    'GPS ping request should identify user 4 as needing location update'
);

-- ── Test 7: Update user location via RPC ──────────────────────────────────
SELECT is(
    (SELECT (public.update_user_location(40.7600, -74.0600) ->> 'success')),
    'true',
    'User location update should succeed'
);

-- ── Test 8: User 4 location should now be updated ───────────────────────────
SELECT is(
    (SELECT last_location_updated_at > NOW() - INTERVAL '1 minute' FROM public.profiles WHERE id = '44444444-4444-4444-4444-444444444444'),
    true,
    'User 4 location should be updated'
);

-- ── Test 9: Get event coordinates from venue ──────────────────────────────
SELECT results_eq(
    $$
    SELECT latitude, longitude FROM public.get_event_coordinates('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID)
    $$,
    $$
    VALUES (40.7128::DOUBLE PRECISION, -74.0060::DOUBLE PRECISION)
    $$,
    'Event coordinates should match venue coordinates'
);

-- ── Test 10: First user cancels → closest waitlisted user promoted ───────────
-- User 3 is at (40.7500, -74.0500), User 4 updated to (40.7600, -74.0600)
-- Venue is at (40.7128, -74.0060)
-- User 3 should be closer and get promoted
SELECT public.cancel_event_rsvp(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111'
);

SELECT is(
    (SELECT status FROM public.event_rsvps
     WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
       AND user_id = '33333333-3333-3333-3333-333333333333'),
    'attending',
    'User 3 (closer) should have been promoted to attending'
);

-- ── Test 11: User 4 should still be on waitlist ────────────────────────────
SELECT is(
    (SELECT COUNT(*) FROM public.event_waitlist
     WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
       AND user_id = '44444444-4444-4444-4444-444444444444'),
    1,
    'User 4 (farther) should still be on waitlist'
);

-- ── Test 12: Second user is still attending ───────────────────────────────
SELECT is(
    (SELECT status FROM public.event_rsvps
     WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
       AND user_id = '22222222-2222-2222-2222-222222222222'),
    'attending',
    'Second user should still be attending'
);

-- ── Cleanup ───────────────────────────────────────────────────────────────
DELETE FROM public.event_rsvps WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DELETE FROM public.event_waitlist WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DELETE FROM public.event_venues WHERE event_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DELETE FROM public.events WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DELETE FROM public.clubs WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
DELETE FROM public.profiles WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444'
);

SELECT * FROM finish();
ROLLBACK;
