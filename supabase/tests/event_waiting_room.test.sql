-- ============================================================
-- Test Suite: event_waiting_room.test.sql
-- Description: Verifies high_demand column schema on events table.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(2);

-- Test 1: Check high_demand column exists on events
SELECT has_column('public', 'events', 'high_demand', 'Column high_demand should exist on events');

-- Test 2: Check high_demand is of type boolean
SELECT col_type_is('public', 'events', 'high_demand', 'boolean', 'Column high_demand should be of type boolean');

SELECT * FROM finish();
ROLLBACK;
