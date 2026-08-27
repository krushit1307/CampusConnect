-- ============================================================
-- Test Suite: weekly_digest.test.sql
-- Description: Verifies get_weekly_digest_events SQL function.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(2);

-- Test 1: Check get_weekly_digest_events function exists
SELECT has_function(
  'public',
  'get_weekly_digest_events',
  ARRAY[]::text[],
  'Function get_weekly_digest_events() should exist'
);

-- Test 2: Check get_digest_subscribers function exists
SELECT has_function(
  'public',
  'get_digest_subscribers',
  ARRAY[]::text[],
  'Function get_digest_subscribers() should exist'
);

SELECT * FROM finish();
ROLLBACK;
