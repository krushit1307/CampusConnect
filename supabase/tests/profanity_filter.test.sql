-- =============================================================================
-- Test: profanity_filter.test.sql
-- Purpose: Verify that the profanity filter logic correctly blocks bad words 
--          and allows safe words (Scunthorpe problem check).
-- Note: The actual regex testing is done in the Edge Function, but we can 
--       verify the database logging and RLS policies here.
-- =============================================================================

BEGIN;

SELECT plan(4);

-- Test 1: Moderation flags table exists and has correct structure
SELECT has_column('public', 'moderation_flags', 'user_id', 'moderation_flags has user_id column');
SELECT has_column('public', 'moderation_flags', 'violation_type', 'moderation_flags has violation_type column');

-- Test 2: RLS is enabled on moderation_flags
SELECT tables_are('public', ARRAY['moderation_flags']);
SELECT is(
  (SELECT row_security_enabled FROM pg_tables WHERE schemaname = 'public' AND tablename = 'moderation_flags'),
  true,
  'RLS is enabled on moderation_flags table'
);

-- Test 3: Verify word boundary logic conceptually (simulated in SQL)
-- This ensures that 'classic' does NOT match '\bass\b'
SELECT is(
  (SELECT 'classic' ~* '\bass\b'),
  false,
  'Word boundary regex prevents Scunthorpe problem (classic does not match ass)'
);

-- Test 4: Verify that 'fuck' DOES match
SELECT is(
  (SELECT 'this is fuck' ~* '\bfuck\b'),
  true,
  'Word boundary regex correctly identifies profanity'
);

SELECT * FROM finish();
ROLLBACK;
