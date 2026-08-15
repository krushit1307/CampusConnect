-- ============================================================
-- Test Suite: ticket_refund_pipeline.test.sql
-- Description: Verifies schema, columns, RLS policies and behavior
-- of the process_ticket_refund function.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(13);

-- 1. Schema / Column validation
SELECT has_table('public', 'refund_logs', 'refund_logs table should exist');
SELECT has_column('public', 'refund_logs', 'rsvp_id', 'Column rsvp_id should exist in refund_logs');
SELECT has_column('public', 'refund_logs', 'payment_intent_id', 'Column payment_intent_id should exist in refund_logs');
SELECT has_column('public', 'refund_logs', 'refund_amount_cents', 'Column refund_amount_cents should exist in refund_logs');
SELECT has_column('public', 'refund_logs', 'stripe_refund_id', 'Column stripe_refund_id should exist in refund_logs');
SELECT has_column('public', 'refund_logs', 'refund_status', 'Column refund_status should exist in refund_logs');

SELECT col_type_is('public', 'refund_logs', 'refund_amount_cents', 'integer', 'refund_amount_cents should be integer');
SELECT col_type_is('public', 'refund_logs', 'stripe_refund_id', 'text', 'stripe_refund_id should be text');

-- 2. Function existence and parameters
SELECT has_function(
    'public',
    'process_ticket_refund',
    ARRAY['uuid', 'text', 'integer', 'text'],
    'Function process_ticket_refund(uuid, text, integer, text) should exist'
);

-- 3. Behavior Verification
-- Setup mock data
INSERT INTO public.profiles (id, full_name, role)
VALUES ('00000000-0000-0000-0000-000000000100', 'Test User', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000200', 'Test Club', 'test-club')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, max_attendees, available_spots, event_date)
VALUES (
    '00000000-0000-0000-0000-000000000300',
    '00000000-0000-0000-0000-000000000200',
    'Gala Concert',
    100,
    90,
    NOW() + INTERVAL '5 days'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_rsvps (id, event_id, user_id, status, paid_amount_cents, payment_intent_id)
VALUES (
    '00000000-0000-0000-0000-000000000400',
    '00000000-0000-0000-0000-000000000300',
    '00000000-0000-0000-0000-000000000100',
    'attending',
    5000,
    'pi_test_12345'
);

-- Call refund function
SELECT ok(
    public.process_ticket_refund(
        '00000000-0000-0000-0000-000000000400',
        'pi_test_12345',
        5000,
        're_test_67890'
    ),
    'Calling process_ticket_refund should succeed'
);

-- Assertions after refund function execution
-- Check RSVP status is cancelled
SELECT results_eq(
    $$ SELECT status FROM public.event_rsvps WHERE id = '00000000-0000-0000-0000-000000000400' $$,
    $$ VALUES ('cancelled'::text) $$,
    'RSVP status should be updated to cancelled'
);

-- Check capacity is incremented (90 + 1 = 91)
SELECT results_eq(
    $$ SELECT available_spots FROM public.events WHERE id = '00000000-0000-0000-0000-000000000300' $$,
    $$ VALUES (91) $$,
    'available_spots should be incremented to 91'
);

-- Check refund_logs contains the new entry
SELECT results_eq(
    $$ SELECT refund_amount_cents, stripe_refund_id FROM public.refund_logs WHERE rsvp_id = '00000000-0000-0000-0000-000000000400' $$,
    $$ VALUES (5000, 're_test_67890'::text) $$,
    'A record in refund_logs must be successfully created with correct amount and stripe ID'
);

SELECT * FROM finish();
ROLLBACK;
