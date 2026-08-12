-- ============================================================
-- Test Suite: annual_recap_wrapped.test.sql
-- Description: Verifies yearly_recaps table structures, calculation RPCs,
--              and cache generate function.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(8);

-- Test 1: Check yearly_recaps table exists
SELECT has_table('public', 'yearly_recaps', 'Table yearly_recaps should exist');

-- Test 2: Check columns on yearly_recaps table
SELECT has_column('public', 'yearly_recaps', 'user_id', 'Column user_id should exist on yearly_recaps');
SELECT has_column('public', 'yearly_recaps', 'year', 'Column year should exist on yearly_recaps');
SELECT has_column('public', 'yearly_recaps', 'payload', 'Column payload should exist on yearly_recaps');

-- Test 3: Check get_yearly_recap_computed function exists
SELECT has_function(
  'public',
  'get_yearly_recap_computed',
  ARRAY['uuid', 'integer'],
  'Function get_yearly_recap_computed(UUID, INT) should exist'
);

-- Test 4: Check generate_yearly_recap RPC function exists
SELECT has_function(
  'public',
  'generate_yearly_recap',
  ARRAY['uuid', 'integer'],
  'Function generate_yearly_recap(UUID, INT) should exist'
);

-- Test 5: Check precompute_yearly_recaps function exists
SELECT has_function(
  'public',
  'precompute_yearly_recaps',
  ARRAY['integer'],
  'Function precompute_yearly_recaps(INT) should exist'
);

SELECT * FROM finish();
ROLLBACK;
