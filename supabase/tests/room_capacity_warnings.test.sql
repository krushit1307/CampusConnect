-- ============================================================
-- Test Suite: room_capacity_warnings.test.sql
-- Description: Verifies columns, triggers, and capacity detection.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (8 tests)
SELECT plan(8);

-- 1. Verify Column Existence on public.events
SELECT has_column('public', 'events', 'venue_capacity', 'Column venue_capacity should exist in events table');
SELECT has_column('public', 'events', 'capacity_warning_sent', 'Column capacity_warning_sent should exist in events table');
SELECT col_type_is('public', 'events', 'venue_capacity', 'integer', 'venue_capacity should be integer');
SELECT col_type_is('public', 'events', 'capacity_warning_sent', 'boolean', 'capacity_warning_sent should be boolean');

-- 2. Verify Trigger Existence on public.event_rsvps
SELECT has_trigger('public', 'event_rsvps', 'trg_on_rsvp_inserted_capacity_check', 'Trigger trg_on_rsvp_inserted_capacity_check should exist');

-- 3. Behavior Verification
-- Setup mock profile and club
INSERT INTO public.profiles (id, full_name, role)
VALUES ('00000000-0000-0000-0000-000000000099', 'President User', 'club_admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES ('00000000-0000-0000-0000-000000000088', 'Test Capacity Club', 'test-capacity-club', '00000000-0000-0000-0000-000000000099')
ON CONFLICT (id) DO NOTHING;

-- Insert Mock Event with capacity = 10
INSERT INTO public.events (id, title, venue_capacity, capacity_warning_sent, start_date, end_date)
VALUES (
    '00000000-0000-0000-0000-000000000077',
    'Low Capacity Workshop',
    10,
    FALSE,
    NOW(),
    NOW() + INTERVAL '2 hours'
)
ON CONFLICT (id) DO NOTHING;

-- Add Event Host junction row
INSERT INTO public.event_hosts (event_id, club_id, is_primary_host, status)
VALUES (
    '00000000-0000-0000-0000-000000000077',
    '00000000-0000-0000-0000-000000000088',
    TRUE,
    'accepted'
)
ON CONFLICT DO NOTHING;

-- Insert RSVPs to reach 80% (8 RSVPs)
INSERT INTO public.event_rsvps (event_id, user_id, status)
SELECT 
    '00000000-0000-0000-0000-000000000077',
    gen_random_uuid(),
    'approved'
FROM generate_series(1, 8);

-- Test 4: At 80% capacity, warning should not be sent
SELECT is(
    (SELECT capacity_warning_sent FROM public.events WHERE id = '00000000-0000-0000-0000-000000000077'),
    FALSE,
    'capacity_warning_sent is FALSE at 80% capacity'
);

-- Insert 1 more RSVP to reach 90% (9 out of 10)
INSERT INTO public.event_rsvps (event_id, user_id, status)
VALUES ('00000000-0000-0000-0000-000000000077', '00000000-0000-0000-0000-000000000099', 'approved');

-- Test 5: At 90% capacity, warning should be sent
SELECT is(
    (SELECT capacity_warning_sent FROM public.events WHERE id = '00000000-0000-0000-0000-000000000077'),
    TRUE,
    'capacity_warning_sent is TRUE at 90% capacity'
);

-- Insert another RSVP (10 out of 10) to make sure trigger does not fail or reset warning
SELECT lives_ok(
  $$INSERT INTO public.event_rsvps (event_id, user_id, status)
    VALUES ('00000000-0000-0000-0000-000000000077', gen_random_uuid(), 'approved'$$,
  'Succeeds inserting additional RSVPs when warning has already been sent'
);

SELECT * FROM finish();
ROLLBACK;
