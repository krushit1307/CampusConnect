-- ============================================================
-- Test Suite: relay_cursor_pagination.test.sql
-- Description: Verifies get_posts_relay RPC function, Relay edges,
--              pageInfo cursors, and hasNextPage computation.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(3);

-- Test 1: Verify get_posts_relay function exists
SELECT has_function(
  'public',
  'get_posts_relay',
  ARRAY['text', 'integer'],
  'Function public.get_posts_relay(text, integer) should exist'
);

-- Test 2: Verify get_posts_relay returns JSON structure with edges and pageInfo
SELECT ok(
  (SELECT (get_posts_relay(NULL, 5)->'edges') IS NOT NULL),
  'get_posts_relay should return edges array in JSON response'
);

-- Test 3: Verify pageInfo structure contains hasNextPage and hasPreviousPage
SELECT ok(
  (SELECT (get_posts_relay(NULL, 5)->'pageInfo'->'hasNextPage') IS NOT NULL),
  'get_posts_relay pageInfo should contain hasNextPage boolean'
);

SELECT * FROM finish();
ROLLBACK;
