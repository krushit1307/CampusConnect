-- ============================================================
-- Test Suite: concurrent_refresh.test.sql
-- Description: Verifies unique index requirements for concurrent MV
--              refreshes and tests concurrent execution directly.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (4 tests)
SELECT plan(4);

-- Test 1: Verify UNIQUE indexes exist on both materialized views
SELECT has_index(
  'public',
  'club_stats',
  'idx_club_stats_club_id',
  'Unique index idx_club_stats_club_id should exist on club_stats'
);

SELECT has_index(
  'public',
  'club_analytics_mat_view',
  'idx_club_analytics_mat_view_club_id',
  'Unique index idx_club_analytics_mat_view_club_id should exist on club_analytics_mat_view'
);

-- Test 2: Verify REFRESH MATERIALIZED VIEW CONCURRENTLY works on both views without error
SELECT lives_ok(
  'REFRESH MATERIALIZED VIEW CONCURRENTLY public.club_stats;',
  'Refreshing club_stats concurrently should succeed'
);

SELECT lives_ok(
  'REFRESH MATERIALIZED VIEW CONCURRENTLY public.club_analytics_mat_view;',
  'Refreshing club_analytics_mat_view concurrently should succeed'
);

SELECT * FROM finish();
ROLLBACK;
