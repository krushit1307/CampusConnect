-- ============================================================
-- Test Suite: automated_event_cancellation_refunds.test.sql
-- Description: Verifies schema, RPC execution, event status updates,
-- mass RSVP cancellation, and refund logging for Issue #3342.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(8);

-- 1. Schema Validation
SELECT has_column('public', 'events', 'cancellation_reason', 'Column cancellation_reason should exist');
SELECT has_function('public', 'cancel_event_and_refund', ARRAY['uuid', 'text'], 'RPC cancel_event_and_refund should exist');

-- 2. Mock Data Setup
INSERT INTO public.clubs (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'Blizzard Club', 'blizzard-club')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, status, max_attendees)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Blizzard Concert', 'scheduled', 200)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, role)
VALUES ('33333333-3333-3333-3333-333333333333', 'Attendee', 'One', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_rsvps (id, event_id, user_id, status, paid_amount_cents, payment_intent_id)
VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'attending', 2000, 'pi_blizzard_test');

-- 3. Execute Mass Event Cancellation & Refunds
SELECT is(
    (public.cancel_event_and_refund('22222222-2222-2222-2222-222222222222', 'Blizzard Emergency')->>'success')::boolean,
    true,
    'Executing cancel_event_and_refund should return success = true'
);

-- Check Event Status is cancelled
SELECT results_eq(
    $$ SELECT status FROM public.events WHERE id = '22222222-2222-2222-2222-222222222222' $$,
    $$ VALUES ('cancelled'::text) $$,
    'Event status should be updated to cancelled'
);

-- Check RSVP Status is cancelled
SELECT results_eq(
    $$ SELECT status FROM public.event_rsvps WHERE id = '44444444-4444-4444-4444-444444444444' $$,
    $$ VALUES ('cancelled'::text) $$,
    'RSVP status should be updated to cancelled'
);

-- Check Refund Logs
SELECT results_eq(
    $$ SELECT refund_amount_cents FROM public.refund_logs WHERE rsvp_id = '44444444-4444-4444-4444-444444444444' $$,
    $$ VALUES (2000) $$,
    'Mass refund log entry should record 2000 cents refund'
);

SELECT * FROM finish();
ROLLBACK;
