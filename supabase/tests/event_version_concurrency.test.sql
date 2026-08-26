-- ============================================================
-- Test Suite: event_version_concurrency.test.sql
-- Description: Verifies events table version column for optimistic concurrency control.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(7);

-- Test 1: Check events table exists
SELECT has_table('public', 'events', 'Table events should exist');

-- Test 2: Check version column on events table
SELECT has_column('public', 'events', 'version', 'Column version should exist on events');

-- Test 3: Check version_vector column on events table
SELECT has_column('public', 'events', 'version_vector', 'Column version_vector should exist on events');

-- Test 4: Verify OCC update behaves correctly on version mismatch
-- Setup test profile for creator (auto-created by handle_new_user trigger)
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('90000000-0000-0000-0000-000000000003', 'eventocctest@test.com', 'authenticated', 'authenticated', '{"full_name": "Event OCC Test Creator"}')
ON CONFLICT (id) DO NOTHING;

-- Insert event with initial version = 1
INSERT INTO public.events (id, title, description, created_by, version, start_date, end_date)
VALUES (
    '90000000-0000-0000-0000-000000000004',
    'OCC Test Event',
    'Original Description',
    '90000000-0000-0000-0000-000000000003',
    1,
    NOW(),
    NOW()
);

-- First writer: guarded UPDATE from version 1 to 2 succeeds
UPDATE public.events
SET description = 'First Writer Description', version = 2
WHERE id = '90000000-0000-0000-0000-000000000004' AND version = 1;

SELECT is(
    (SELECT version FROM public.events WHERE id = '90000000-0000-0000-0000-000000000004'),
    2,
    'Guarded update from version 1 to 2 succeeds'
);

SELECT is(
    (SELECT description FROM public.events WHERE id = '90000000-0000-0000-0000-000000000004'),
    'First Writer Description',
    'First writer description is persisted after successful guarded update'
);

-- Second writer with stale version 1: UPDATE affects 0 rows
UPDATE public.events
SET description = 'Stale Update', version = 3
WHERE id = '90000000-0000-0000-0000-000000000004' AND version = 1;

SELECT is(
    (SELECT description FROM public.events WHERE id = '90000000-0000-0000-0000-000000000004'),
    'First Writer Description',
    'Stale update (version mismatch) affects 0 rows and does not modify description'
);

SELECT is(
    (SELECT version FROM public.events WHERE id = '90000000-0000-0000-0000-000000000004'),
    2,
    'Version stays 2 after stale update is rejected'
);

SELECT * FROM finish();
ROLLBACK;
