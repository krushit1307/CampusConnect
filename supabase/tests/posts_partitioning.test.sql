-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(3);

-- Grant privileges to authenticated role so that table-level permissions do not interfere with RLS testing
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock data
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000301', 'author_partition@test.com', 'authenticated', 'authenticated', '{"full_name": "Author Partition"}')
ON CONFLICT (id) DO NOTHING;

-- Create a club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000302', 'Test Partition Club', 'test-partition-club', 'A club for testing partitioning', '90000000-0000-0000-0000-000000000301')
ON CONFLICT (id) DO NOTHING;


-- ==========================================
-- Test Case 1: Verify public.posts is a partitioned table
-- ==========================================
SELECT ok(
  (SELECT partstrat IS NOT NULL FROM pg_partitioned_table pt JOIN pg_class c ON c.oid = pt.partrelid WHERE c.relname = 'posts'),
  'Table public.posts should be a partitioned table'
);

-- ==========================================
-- Test Case 2: Verify default partition posts_default exists
-- ==========================================
SELECT has_table('public', 'posts_default', 'Should have a default catch-all partition named posts_default');

-- ==========================================
-- Test Case 3: Verify dynamic auto-creation of partitions on insert
-- ==========================================
-- Insert a post into a future month (e.g., January 2035) to verify the partition trigger works on insertion
INSERT INTO public.posts (club_id, author_id, content, created_at)
VALUES (
  '90000000-0000-0000-0000-000000000302',
  '90000000-0000-0000-0000-000000000301',
  'This is a future post in Jan 2035.',
  '2035-01-15 12:00:00+00'
);

SELECT has_table('public', 'posts_2035_01', 'Inserting a post in 2035-01 should automatically create table public.posts_2035_01');

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
