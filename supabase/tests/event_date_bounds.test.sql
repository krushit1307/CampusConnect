-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (3 tests)
SELECT plan(3);

-- Test 1: Inserting event with start_date < end_date succeeds
SELECT lives_ok(
  $$INSERT INTO public.events (id, title, start_date, end_date) 
    VALUES ('10000000-0000-0000-0000-000000000001', 'Test Event 1', '2026-07-19 10:00:00+00', '2026-07-19 12:00:00+00')$$,
  'Can insert event where start_date is before end_date'
);

-- Test 2: Inserting event with start_date = end_date succeeds
SELECT lives_ok(
  $$INSERT INTO public.events (id, title, start_date, end_date) 
    VALUES ('10000000-0000-0000-0000-000000000002', 'Test Event 2', '2026-07-19 10:00:00+00', '2026-07-19 10:00:00+00')$$,
  'Can insert event where start_date is equal to end_date'
);

-- Test 3: Inserting event with start_date > end_date fails with check_violation
SELECT throws_ok(
  $$INSERT INTO public.events (id, title, start_date, end_date) 
    VALUES ('10000000-0000-0000-0000-000000000003', 'Test Event 3', '2026-07-19 11:00:00+00', '2026-07-19 10:00:00+00')$$,
  '23514', -- Postgres check_violation error code
  NULL,
  'Cannot insert event where start_date is after end_date'
);

SELECT * FROM finish();
ROLLBACK;
