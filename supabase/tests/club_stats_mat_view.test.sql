-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (we have 4 tests)
SELECT plan(4);

-- Test 1: Check if club_stats materialized view exists
SELECT has_relation('public', 'club_stats', 'Materialized view club_stats should exist');

-- Test 2: Check if unique index idx_club_stats_club_id exists on club_stats
SELECT has_index('public', 'club_stats', 'idx_club_stats_club_id', 'Unique index idx_club_stats_club_id should exist on club_stats');

-- Test 3: Check column definitions on club_stats
SELECT has_column('public', 'club_stats', 'total_members', 'Column total_members should exist on club_stats');

-- Test 4: Check if get_club_stats function exists
SELECT has_function('public', 'get_club_stats', ARRAY['uuid'], 'Function get_club_stats(uuid) should exist');

-- Finish the tests and clean up
SELECT * FROM finish();
ROLLBACK;
