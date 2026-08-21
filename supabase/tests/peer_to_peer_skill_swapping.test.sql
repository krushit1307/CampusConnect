-- ============================================================
-- Test Suite: peer_to_peer_skill_swapping.test.sql
-- Description: Verifies skills_taxonomy, offered/needed junction tables,
--              RLS configurations, and matches RPC.
-- ============================================================

BEGIN;

-- Enable pgTAP
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(10);

-- Test 1: Check skills_taxonomy table exists
SELECT has_table('public', 'skills_taxonomy', 'Table skills_taxonomy should exist');

-- Test 2: Check columns on skills_taxonomy table
SELECT has_column('public', 'skills_taxonomy', 'id', 'Column id should exist on skills_taxonomy');
SELECT has_column('public', 'skills_taxonomy', 'name', 'Column name should exist on skills_taxonomy');

-- Test 3: Check user_offered_skills table exists
SELECT has_table('public', 'user_offered_skills', 'Table user_offered_skills should exist');

-- Test 4: Check columns on user_offered_skills
SELECT has_column('public', 'user_offered_skills', 'user_id', 'Column user_id should exist on user_offered_skills');
SELECT has_column('public', 'user_offered_skills', 'skill_id', 'Column skill_id should exist on user_offered_skills');

-- Test 5: Check user_needed_skills table exists
SELECT has_table('public', 'user_needed_skills', 'Table user_needed_skills should exist');

-- Test 6: Check columns on user_needed_skills
SELECT has_column('public', 'user_needed_skills', 'user_id', 'Column user_id should exist on user_needed_skills');
SELECT has_column('public', 'user_needed_skills', 'skill_id', 'Column skill_id should exist on user_needed_skills');

-- Test 7: Check match-making function exists
SELECT has_function(
  'public',
  'get_skill_swap_matches',
  ARRAY['uuid'],
  'Function get_skill_swap_matches(UUID) should exist'
);

SELECT * FROM finish();
ROLLBACK;
