-- ============================================================
-- Test Suite: event_conflict_detection.test.sql
-- Description: Tests check_schedule_conflict and get_user_schedule_conflicts.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(8);

-- 1. Check functions exist
SELECT has_function('public', 'check_schedule_conflict', ARRAY['uuid', 'timestamptz', 'timestamptz', 'boolean'], 'Function check_schedule_conflict should exist');
SELECT has_function('public', 'get_user_schedule_conflicts', ARRAY['uuid', 'boolean'], 'Function get_user_schedule_conflicts should exist');

-- 2. Mock profiles and events
INSERT INTO public.profiles (id, full_name, role)
VALUES 
  ('00000000-0000-0000-0000-00000000009a', 'Conflict Test Student', 'student')
ON CONFLICT (id) DO NOTHING;

-- Event A: 12:00 PM to 1:00 PM
INSERT INTO public.events (id, title, start_date, end_date)
VALUES (
    '00000000-0000-0000-0000-00000000009b',
    'Event A',
    '2026-09-01 12:00:00+00',
    '2026-09-01 13:00:00+00'
);

-- RSVP to Event A
INSERT INTO public.event_rsvps (id, event_id, user_id)
VALUES (
    '00000000-0000-0000-0000-00000000009c',
    '00000000-0000-0000-0000-00000000009b',
    '00000000-0000-0000-0000-00000000009a'
);

-- 3. Check conflict with overlapping Event B: 12:30 PM to 1:30 PM
SELECT results_eq(
    $$ SELECT conflict_event_title FROM public.check_schedule_conflict('00000000-0000-0000-0000-00000000009a', '2026-09-01 12:30:00+00'::timestamptz, '2026-09-01 13:30:00+00'::timestamptz, false) $$,
    $$ VALUES ('Event A'::text) $$,
    'Overlapping Event B (12:30 - 13:30) should conflict with Event A (12:00 - 13:00)'
);

-- 4. Check no conflict with Event C (no overlap, no buffer): 1:00 PM to 2:00 PM
SELECT is_empty(
    $$ SELECT conflict_event_title FROM public.check_schedule_conflict('00000000-0000-0000-0000-00000000009a', '2026-09-01 13:00:00+00'::timestamptz, '2026-09-01 14:00:00+00'::timestamptz, false) $$,
    'Event C (13:00 - 14:00) should NOT conflict with Event A (12:00 - 13:00) when buffer is FALSE'
);

-- 5. Check conflict with Event C (touching, buffer active): 1:00 PM to 2:00 PM
SELECT results_eq(
    $$ SELECT conflict_event_title FROM public.check_schedule_conflict('00000000-0000-0000-0000-00000000009a', '2026-09-01 13:00:00+00'::timestamptz, '2026-09-01 14:00:00+00'::timestamptz, true) $$,
    $$ VALUES ('Event A'::text) $$,
    'Event C (13:00 - 14:00) should conflict with Event A (12:00 - 13:00) when buffer is TRUE'
);

-- 6. Check conflict with Event D (gap of 10 min, buffer active): 1:10 PM to 2:00 PM
SELECT results_eq(
    $$ SELECT conflict_event_title FROM public.check_schedule_conflict('00000000-0000-0000-0000-00000000009a', '2026-09-01 13:10:00+00'::timestamptz, '2026-09-01 14:00:00+00'::timestamptz, true) $$,
    $$ VALUES ('Event A'::text) $$,
    'Event D (13:10 - 14:00) should conflict with Event A (12:00 - 13:00) when buffer is TRUE'
);

-- 7. Check no conflict with Event E (gap of 15 min, buffer active): 1:15 PM to 2:00 PM
SELECT is_empty(
    $$ SELECT conflict_event_title FROM public.check_schedule_conflict('00000000-0000-0000-0000-00000000009a', '2026-09-01 13:15:00+00'::timestamptz, '2026-09-01 14:00:00+00'::timestamptz, true) $$,
    'Event E (13:15 - 14:00) should NOT conflict with Event A (12:00 - 13:00) when buffer is TRUE'
);

-- 8. Test get_user_schedule_conflicts returns correct overlap count
-- Add Event F: 12:45 PM to 1:45 PM (RSVP to it)
INSERT INTO public.events (id, title, start_date, end_date)
VALUES (
    '00000000-0000-0000-0000-00000000009d',
    'Event F',
    '2026-09-01 12:45:00+00',
    '2026-09-01 13:45:00+00'
);

INSERT INTO public.event_rsvps (id, event_id, user_id)
VALUES (
    '00000000-0000-0000-0000-00000000009e',
    '00000000-0000-0000-0000-00000000009d',
    '00000000-0000-0000-0000-00000000009a'
);

SELECT results_eq(
    $$ SELECT event_title, conflict_event_title FROM public.get_user_schedule_conflicts('00000000-0000-0000-0000-00000000009a', false) $$,
    $$ VALUES ('Event A'::text, 'Event F'::text) $$,
    'get_user_schedule_conflicts should return the conflicting pair Event A and Event F'
);

SELECT * FROM finish();
ROLLBACK;
