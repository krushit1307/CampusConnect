-- ============================================================
-- Test Suite: accessibility_needs_aggregator.test.sql
-- Description: Verifies event logistics aggregations for diet and access.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(4);

-- 1. Check function exists
SELECT has_function('public', 'aggregate_event_logistics', 'aggregate_event_logistics function should exist');

-- 2. Mock profiles, event, RSVPs, banquet assignments and accommodation requests
INSERT INTO auth.users (id, email)
VALUES
    ('00000000-0000-0000-0000-000000000da1', 'u1_logistics@student.edu'),
    ('00000000-0000-0000-0000-000000000da2', 'u2_logistics@student.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, first_name, last_name, handle, email)
VALUES
    ('00000000-0000-0000-0000-000000000da1', 'U1', 'Logistics', 'u1_l', 'u1_logistics@student.edu'),
    ('00000000-0000-0000-0000-000000000da2', 'U2', 'Logistics', 'u2_l', 'u2_logistics@student.edu')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, created_by)
VALUES (
    '00000000-0000-0000-0000-000000000dc1',
    'Logistics Club',
    'logistics-club',
    '00000000-0000-0000-0000-000000000da1'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.venues (id, name, building, capacity)
VALUES ('00000000-0000-0000-0000-000000000dv1', 'Logistics Room', 'Science Hall', 100)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, club_id, title, status, start_time, end_time, created_by, venue_id)
VALUES (
    '00000000-0000-0000-0000-000000000de5',
    '00000000-0000-0000-0000-000000000dc1',
    'Logistics Gala',
    'published',
    now() + INTERVAL '1 hour',
    now() + INTERVAL '2 hours',
    '00000000-0000-0000-0000-000000000da1',
    '00000000-0000-0000-0000-000000000dv1'
)
ON CONFLICT (id) DO NOTHING;

-- Mock RSVPs (both attending)
INSERT INTO public.event_rsvps (id, event_id, user_id, status, checked_in)
VALUES
    ('00000000-0000-0000-0000-000000000dr1', '00000000-0000-0000-0000-000000000de5', '00000000-0000-0000-0000-000000000da1', 'attending', false),
    ('00000000-0000-0000-0000-000000000dr2', '00000000-0000-0000-0000-000000000de5', '00000000-0000-0000-0000-000000000da2', 'attending', false)
ON CONFLICT (id) DO NOTHING;

-- Mock Banquet Tables & Seat Assignments (User A: Vegan, User B: Halal)
INSERT INTO public.banquet_tables (id, event_id, table_number, table_name, capacity)
VALUES ('00000000-0000-0000-0000-000000000dt1', '00000000-0000-0000-0000-000000000de5', 1, 'Table A', 8)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.banquet_seat_assignments (id, table_id, user_id, user_name, dietary_needs)
VALUES
    ('00000000-0000-0000-0000-000000000da5', '00000000-0000-0000-0000-000000000dt1', '00000000-0000-0000-0000-000000000da1', 'U1', ARRAY['Vegan']),
    ('00000000-0000-0000-0000-000000000da6', '00000000-0000-0000-0000-000000000dt1', '00000000-0000-0000-0000-000000000da2', 'U2', ARRAY['Halal'])
ON CONFLICT (id) DO NOTHING;

-- Mock Accommodation requests (1 ASL Interpreter, 1 Wheelchair Access)
INSERT INTO public.accommodation_requests (id, event_id, requester_id, accommodation_type, state)
VALUES
    ('00000000-0000-0000-0000-000000000da8', '00000000-0000-0000-0000-000000000de5', '00000000-0000-0000-0000-000000000da1', 'ASL_INTERPRETER', 'SUBMITTED'),
    ('00000000-0000-0000-0000-000000000da9', '00000000-0000-0000-0000-000000000de5', '00000000-0000-0000-0000-000000000da2', 'WHEELCHAIR_SEATING', 'SUBMITTED')
ON CONFLICT (id) DO NOTHING;

-- 3. Assert results
SELECT results_eq(
    $$
    SELECT (public.aggregate_event_logistics('00000000-0000-0000-0000-000000000de5') ->> 'total_registered')::INTEGER;
    $$,
    ARRAY[2],
    'Total registered attendees should be 2'
);

SELECT results_eq(
    $$
    SELECT (public.aggregate_event_logistics('00000000-0000-0000-0000-000000000de5') -> 'dietary') ->> 'Vegan';
    $$,
    ARRAY['1'],
    'Vegan dietary needs count should be 1'
);

SELECT results_eq(
    $$
    SELECT (public.aggregate_event_logistics('00000000-0000-0000-0000-000000000de5') -> 'accessibility') ->> 'ASL Interpreter';
    $$,
    ARRAY['1'],
    'ASL Interpreter requested count should be 1'
);

ROLLBACK;
