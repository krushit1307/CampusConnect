-- ============================================================
-- Test Suite: export_pipeline.test.sql
-- Description: Verifies private storage bucket creation for
--              export pipeline data storage.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (2 tests)
SELECT plan(2);

-- Test 1: Verify the exports bucket exists in storage.buckets
SELECT ok(
  EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'exports'),
  'Storage bucket "exports" should exist'
);

-- Test 2: Verify the exports bucket is private (public = false)
SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'exports'),
  false,
  'Storage bucket "exports" should be private'
);

SELECT * FROM finish();
ROLLBACK;
