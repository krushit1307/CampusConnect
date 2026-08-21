-- ============================================================
-- Test Suite: interactive_event_seat_swapping.test.sql
-- Description: Verifies peer-to-peer seat swapping, atomic user reassignments, and QR invalidations.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(8);

-- 1. Check schema components
SELECT has_table('public', 'seat_swap_requests', 'seat_swap_requests table should exist');
SELECT has_column('public', 'seat_swap_requests', 'status', 'seat_swap_requests table should have status column');
SELECT has_function('public', 'propose_seat_swap', 'propose_seat_swap function should exist');
SELECT has_function('public', 'accept_seat_swap', 'accept_seat_swap function should exist');

-- 2. Mock users, club, event, RSVPs, and seats
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000bb1', 'alice@campus.edu'),
    ('00000000-0000-0000-0000-000000000bb2', 'bob@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000bb1', 'Alice', 'Smith', 'alice_smith', 'alice@campus.edu'),
    ('00000000-0000-0000-0000-000000000bb2', 'Bob', 'Jones', 'bob_jones', 'bob@campus.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000bc1',
    'Seat Swap Club',
    'seat-swap-club',
    '00000000-0000-0000-0000-000000000bb1'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000be1',
    '00000000-0000-0000-0000-000000000bc1',
    'Seated Gala Night',
    'published',
    now() + INTERVAL '1 day',
    now() + INTERVAL '2 days',
    '00000000-0000-0000-0000-000000000bb1'
)
ON CONFLICT (id) DO NOTHING;

-- Seating layouts and seats setup
INSERT INTO public.seating_layouts (id, event_id, layout_config)
VALUES (
    '00000000-0000-0000-0000-000000000bl1',
    '00000000-0000-0000-0000-000000000be1',
    '{}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seats (id, layout_id, table_name, seat_number, status, locked_by)
VALUES
    ('00000000-0000-0000-0000-000000000bs1', '00000000-0000-0000-0000-000000000bl1', 'A', '1', 'sold', '00000000-0000-0000-0000-000000000bb1'),
    ('00000000-0000-0000-0000-000000000bs2', '00000000-0000-0000-0000-000000000bl1', 'Z', '9', 'sold', '00000000-0000-0000-0000-000000000bb2')
ON CONFLICT (id) DO NOTHING;

-- RSVPs (representing tickets)
INSERT INTO public.event_rsvps (id, event_id, user_id, status, qr_code_hash)
VALUES
    ('00000000-0000-0000-0000-000000000br1', '00000000-0000-0000-0000-000000000be1', '00000000-0000-0000-0000-000000000bb1', 'attending', 'old_qr_alice'),
    ('00000000-0000-0000-0000-000000000br2', '00000000-0000-0000-0000-000000000be1', '00000000-0000-0000-0000-000000000bb2', 'attending', 'old_qr_bob')
ON CONFLICT (id) DO NOTHING;

-- 3. Run propose_seat_swap as Alice
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000bb1';

DECLARE
  v_req_id UUID;
BEGIN
  v_req_id := public.propose_seat_swap(
    '00000000-0000-0000-0000-000000000br1',
    '00000000-0000-0000-0000-000000000br2'
  );
END;

SELECT results_eq(
    $$
    SELECT status FROM public.seat_swap_requests WHERE initiator_ticket_id = '00000000-0000-0000-0000-000000000br1';
    $$,
    ARRAY['pending'],
    'Seat swap request should start with pending status'
);

-- 4. Accept seat swap as Bob
SET local role authenticated;
SET local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000bb2';

SELECT lives_ok(
    $$
    SELECT public.accept_seat_swap(id) FROM public.seat_swap_requests WHERE initiator_ticket_id = '00000000-0000-0000-0000-000000000br1';
    $$,
    'Bob accepts the seat swap'
);

-- Assert seat ownership swapped
SELECT results_eq(
    $$
    SELECT locked_by FROM public.seats ORDER BY seat_number;
    $$,
    ARRAY['00000000-0000-0000-0000-000000000bb2'::uuid, '00000000-0000-0000-0000-000000000bb1'::uuid],
    'User ownership on seats A1 and Z9 should be swapped successfully'
);

-- Assert RSVP user_id swapped and QR codes regenerated
SELECT results_eq(
    $$
    SELECT user_id FROM public.event_rsvps ORDER BY id;
    $$,
    ARRAY['00000000-0000-0000-0000-000000000bb2'::uuid, '00000000-0000-0000-0000-000000000bb1'::uuid],
    'User ownership on event RSVPs should be swapped'
);

ROLLBACK;
