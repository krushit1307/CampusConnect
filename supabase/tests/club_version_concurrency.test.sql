-- ============================================================
-- Test Suite: club_version_concurrency.test.sql
-- Description: Verifies clubs table version column for concurrency tracking.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(3);

-- Test 1: Check clubs table exists
SELECT has_table('public', 'clubs', 'Table clubs should exist');

-- Test 2: Check columns on clubs table
SELECT has_column('public', 'clubs', 'version', 'Column version should exist on clubs');

-- Test 3: Verify OCC update behaves correctly on version mismatch
-- Setup test profile for creator
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES ('90000000-0000-0000-0000-000000000001', 'occtest@test.com', 'authenticated', 'authenticated', '{"full_name": "OCC Test Creator"}')
ON CONFLICT (id) DO NOTHING;

-- Insert club with initial version = 1
INSERT INTO public.clubs (id, name, slug, description, created_by, version)
VALUES (
    '90000000-0000-0000-0000-000000000002',
    'OCC Test Club',
    'occ-test-club',
    'Original Description',
    '90000000-0000-0000-0000-000000000001',
    1
);

-- Try to update with stale version = 0 (should update 0 rows)
UPDATE public.clubs
SET description = 'Stale Update', version = 2
WHERE id = '90000000-0000-0000-0000-000000000002' AND version = 0;

SELECT is(
    (SELECT description FROM public.clubs WHERE id = '90000000-0000-0000-0000-000000000002'),
    'Original Description',
    'Update fails and does not modify description on version mismatch'
);

SELECT * FROM finish();
ROLLBACK;
