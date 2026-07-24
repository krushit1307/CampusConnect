-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 3 tests)
SELECT plan(3);

-- Test 1: Check if club_visibility type exists
SELECT has_type('club_visibility', 'Type club_visibility should exist');

-- Test 2: Check if visibility column exists on clubs table
SELECT has_column('public', 'clubs', 'visibility', 'Column visibility should exist on clubs table');

-- Test 3: Check column default value is public
SELECT col_default_is('public', 'clubs', 'visibility', 'public'::club_visibility, 'Default visibility should be public');

-- Finish the tests and clean up
SELECT * FROM finish();
ROLLBACK;
