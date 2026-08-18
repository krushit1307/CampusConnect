-- ============================================================
-- Test Suite: secure_file_expiration.test.sql
-- Description: Verifies that sensitive document buckets are configured to be private.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(2);

-- 1. Check that the club_vaults bucket is private
SELECT results_eq(
    $$
    SELECT public FROM storage.buckets WHERE id = 'club_vaults';
    $$,
    ARRAY[FALSE],
    'The club_vaults storage bucket must be private (public = false)'
);

-- 2. Check that the club_documents bucket is private
SELECT results_eq(
    $$
    SELECT public FROM storage.buckets WHERE id = 'club_documents';
    $$,
    ARRAY[FALSE],
    'The club_documents storage bucket must be private (public = false)'
);

ROLLBACK;
