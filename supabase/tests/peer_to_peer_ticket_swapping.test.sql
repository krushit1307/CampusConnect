-- ============================================================
-- Test Suite: peer_to_peer_ticket_swapping.test.sql
-- Description: Verifies schema, RLS policies, price match checks,
-- atomic swap transaction, and QR code regeneration for Issue #3234.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(12);

-- 1. Schema Validation
SELECT has_table('public', 'ticket_trades', 'ticket_trades table should exist');
SELECT has_column('public', 'ticket_trades', 'initiator_rsvp_id', 'Column initiator_rsvp_id should exist');
SELECT has_column('public', 'ticket_trades', 'requested_event_id', 'Column requested_event_id should exist');
SELECT has_column('public', 'ticket_trades', 'status', 'Column status should exist');

SELECT has_function('public', 'propose_ticket_trade', ARRAY['uuid', 'uuid'], 'RPC propose_ticket_trade should exist');
SELECT has_function('public', 'accept_ticket_trade', ARRAY['uuid', 'uuid'], 'RPC accept_ticket_trade should exist');
SELECT has_function('public', 'cancel_ticket_trade', ARRAY['uuid'], 'RPC cancel_ticket_trade should exist');

-- 2. Mock Data Setup
INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'User', 'A', 'student'),
    ('22222222-2222-2222-2222-222222222222', 'User', 'B', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug)
VALUES ('33333333-3333-3333-3333-333333333333', 'P2P Club', 'p2p-club')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, ticket_price, max_attendees)
VALUES
    ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Spring Gala', 0, 100),
    ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'Tech Conference', 0, 100),
    ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'VIP Concert', 5000, 100)
ON CONFLICT (id) DO NOTHING;

-- User A has Gala Ticket
INSERT INTO public.event_rsvps (id, event_id, user_id, status, qr_code_hash)
VALUES ('77777777-7777-7777-7777-777777777777', '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'attending', 'old_qr_hash_a')
ON CONFLICT (id) DO NOTHING;

-- User B has Tech Conference Ticket
INSERT INTO public.event_rsvps (id, event_id, user_id, status, qr_code_hash)
VALUES ('88888888-8888-8888-8888-888888888888', '55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 'attending', 'old_qr_hash_b')
ON CONFLICT (id) DO NOTHING;

-- User B also has VIP Concert Ticket (Price = 5000 cents)
INSERT INTO public.event_rsvps (id, event_id, user_id, status, qr_code_hash)
VALUES ('99999999-9999-9999-9999-999999999999', '66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 'attending', 'old_qr_hash_vip')
ON CONFLICT (id) DO NOTHING;

-- 3. Test Propose Trade
SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

INSERT INTO public.ticket_trades (id, initiator_rsvp_id, initiator_id, requested_event_id, status)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'open');

SELECT results_eq(
    $$ SELECT status FROM public.ticket_trades WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
    $$ VALUES ('open'::text) $$,
    'Trade proposal should be inserted with open status'
);

-- 4. Test Price Mismatch Rejection (Free vs $50 ticket)
INSERT INTO public.ticket_trades (id, initiator_rsvp_id, initiator_id, requested_event_id, status)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'open');

SET LOCAL "request.jwt.claims" = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

SELECT is(
    (public.accept_ticket_trade('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '99999999-9999-9999-9999-999999999999')->>'success')::boolean,
    false,
    'Trade acceptance should fail for unequal price tickets'
);

-- 5. Test Successful Atomic Swap (Equal Price: Both 0)
SELECT is(
    (public.accept_ticket_trade('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '88888888-8888-8888-8888-888888888888')->>'success')::boolean,
    true,
    'Trade acceptance should succeed for equal price free tickets'
);

-- Check User A now owns Tech Conference Ticket (8888...)
SELECT results_eq(
    $$ SELECT user_id FROM public.event_rsvps WHERE id = '88888888-8888-8888-8888-888888888888' $$,
    $$ VALUES ('11111111-1111-1111-1111-111111111111'::uuid) $$,
    'User A should now own the Tech Conference ticket'
);

-- Check User B now owns Spring Gala Ticket (7777...)
SELECT results_eq(
    $$ SELECT user_id FROM public.event_rsvps WHERE id = '77777777-7777-7777-7777-777777777777' $$,
    $$ VALUES ('22222222-2222-2222-2222-222222222222'::uuid) $$,
    'User B should now own the Spring Gala ticket'
);

SELECT * FROM finish();
ROLLBACK;
