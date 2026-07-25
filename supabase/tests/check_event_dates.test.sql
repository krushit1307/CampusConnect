-- ============================================================
-- Test Suite: check_event_dates.test.sql
-- Issue: #1102
-- Description: Verifies check_event_dates constraint on public.events
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (3 tests)
SELECT plan(3);

-- Test 1: Inserting event where end_date > start_date succeeds
SELECT lives_ok(
  $$INSERT INTO public.events (id, title, start_date, end_date) 
    VALUES ('f0000000-0000-0000-0000-000000000001', 'Valid Date Event', '2026-08-01 10:00:00+00', '2026-08-01 12:00:00+00')$$,
  'Event with start_date prior to end_date inserts successfully'
);

-- Test 2: Inserting event where end_date = start_date succeeds
SELECT lives_ok(
  $$INSERT INTO public.events (id, title, start_date, end_date) 
    VALUES ('f0000000-0000-0000-0000-000000000002', 'Same Start End Event', '2026-08-01 10:00:00+00', '2026-08-01 10:00:00+00')$$,
  'Event with start_date equal to end_date inserts successfully'
);

-- Test 3: Inserting event where end_date < start_date fails with check_violation (23514)
SELECT throws_ok(
  $$INSERT INTO public.events (id, title, start_date, end_date) 
    VALUES ('f0000000-0000-0000-0000-000000000003', 'Time Travel Event', '2026-08-01 12:00:00+00', '2026-08-01 10:00:00+00')$$,
  '23514', -- Postgres check_violation error code
  NULL,
  'Event with end_date before start_date is rejected by check_event_dates constraint'
);

SELECT * FROM finish();
ROLLBACK;
