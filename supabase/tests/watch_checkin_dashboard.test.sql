-- ============================================================
-- Test Suite: watch_checkin_dashboard.test.sql
-- Description: Verifies watch pairing database schemas, code generation, verification, and capacity updates.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(13);

-- 1. Schema check
SELECT has_table('public', 'watch_pairings', 'watch_pairings table should exist');
SELECT has_column('public', 'watch_pairings', 'id', 'watch_pairings should have id column');
SELECT has_column('public', 'watch_pairings', 'user_id', 'watch_pairings should have user_id column');
SELECT has_column('public', 'watch_pairings', 'pairing_code', 'watch_pairings should have pairing_code column');
SELECT has_column('public', 'watch_pairings', 'session_token', 'watch_pairings should have session_token column');
SELECT has_column('public', 'watch_pairings', 'expires_at', 'watch_pairings should have expires_at column');
SELECT has_column('public', 'watch_pairings', 'is_used', 'watch_pairings should have is_used column');

SELECT has_function('public', 'create_watch_pairing', ARRAY['text'], 'create_watch_pairing(text) RPC should exist');
SELECT has_function('public', 'verify_watch_pairing', ARRAY['text'], 'verify_watch_pairing(text) RPC should exist');
SELECT has_function('public', 'increment_event_capacity', ARRAY['uuid', 'integer'], 'increment_event_capacity(uuid, integer) RPC should exist');

-- 2. Mock Setup
INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES ('55555555-5555-5555-5555-555555555501', 'Watch', 'Organizer', 'organizer')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug)
VALUES ('55555555-5555-5555-5555-5555555555aa', 'Watch Test Club', 'watch-test-club')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, start_date, end_date, status, max_attendees)
VALUES ('55555555-5555-5555-5555-5555555555b1', '55555555-5555-5555-5555-5555555555aa', 'Watch Event', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '1 hour', 'published', 25)
ON CONFLICT (id) DO NOTHING;

-- Set current authenticated user to the organizer
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555501"}', true);

-- 3. Test create_watch_pairing RPC
SELECT is(
    (SELECT length(public.create_watch_pairing('mock-access-token-1234'))),
    4,
    'create_watch_pairing should generate a 4-digit code'
);

-- Store code for verification
DECLARE
    v_code TEXT;
    v_verified_token TEXT;
BEGIN
    SELECT pairing_code INTO v_code FROM public.watch_pairings LIMIT 1;

    -- 4. Test verify_watch_pairing RPC
    SELECT public.verify_watch_pairing(v_code) INTO v_verified_token;

    -- Assert verification returned correct token
    SELECT is(
        v_verified_token,
        'mock-access-token-1234',
        'verify_watch_pairing should return the paired session token'
    );

    -- Assert pairing record is now marked as used
    SELECT is(
        (SELECT is_used FROM public.watch_pairings WHERE pairing_code = v_code),
        true,
        'verify_watch_pairing should mark the code as used'
    );
END;

-- 5. Test increment_event_capacity RPC
SELECT public.increment_event_capacity('55555555-5555-5555-5555-5555555555b1', 15);

SELECT is(
    (SELECT max_attendees FROM public.events WHERE id = '55555555-5555-5555-5555-5555555555b1'),
    40, -- 25 + 15
    'increment_event_capacity should increase the event capacity limit atomically'
);

ROLLBACK;
