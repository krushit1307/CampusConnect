-- ============================================================
-- Test Suite: comments_cte_optimization.test.sql
-- Issue: #1853
-- Description: Verifies index composite optimizations, depth restriction, and query performance on nested comments
-- ============================================================

BEGIN;

-- Enable pgTAP extension
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (5 tests)
SELECT plan(5);

-- Test 1: Verify composite index idx_comments_post_parent_created exists
SELECT has_index(
  'public',
  'comments',
  'idx_comments_post_parent_created',
  'Composite index idx_comments_post_parent_created should exist on comments table'
);

-- Test 2: Verify composite index idx_comments_parent_id_created exists
SELECT has_index(
  'public',
  'comments',
  'idx_comments_parent_id_created',
  'Composite index idx_comments_parent_id_created should exist on comments table'
);

-- Setup test profile, club, post
INSERT INTO auth.users (id, email)
VALUES ('e0000000-0000-0000-0000-000000000001', 'cte_opt@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('e0000000-0000-0000-0000-000000000002', 'CTE Club', 'cte-club', 'CTE Test Club', 'e0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.posts (id, club_id, author_id, content)
VALUES ('e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'Post for CTE Optimization')
ON CONFLICT (id) DO NOTHING;

-- Seed deep comments (up to level 7)
INSERT INTO public.comments (id, post_id, author_id, content, parent_comment_id, created_at)
VALUES 
  ('e0000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Level 1 Root', NULL, NOW() - INTERVAL '10 minutes'),
  ('e0000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Level 2 Child', 'e0000000-0000-0000-0000-000000000010', NOW() - INTERVAL '9 minutes'),
  ('e0000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Level 3 Child', 'e0000000-0000-0000-0000-000000000011', NOW() - INTERVAL '8 minutes'),
  ('e0000000-0000-0000-0000-000000000013', 'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Level 4 Child', 'e0000000-0000-0000-0000-000000000012', NOW() - INTERVAL '7 minutes'),
  ('e0000000-0000-0000-0000-000000000014', 'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Level 5 Child', 'e0000000-0000-0000-0000-000000000013', NOW() - INTERVAL '6 minutes'),
  ('e0000000-0000-0000-0000-000000000015', 'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'Level 6 Child', 'e0000000-0000-0000-0000-000000000014', NOW() - INTERVAL '5 minutes');

-- Test 3: get_comment_thread respects default max depth of 5
SELECT results_eq(
  $$SELECT MAX(depth) FROM public.get_comment_thread('e0000000-0000-0000-0000-000000000003', NULL, 5)$$,
  $$VALUES (5)$$,
  'Should cap depth at max_depth 5'
);

-- Test 4: Level 6 child excluded when max depth is 5
SELECT is_empty(
  $$SELECT 1 FROM public.get_comment_thread('e0000000-0000-0000-0000-000000000003', NULL, 5) WHERE content = 'Level 6 Child'$$,
  'Level 6 child should be excluded when max_depth = 5'
);

-- Test 5: Pagination limit & offset parameter support
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM public.get_comment_thread('e0000000-0000-0000-0000-000000000003', NULL, 5, 2, 0)$$,
  $$VALUES (2)$$,
  'Should return exactly 2 items when limit is 2'
);

SELECT * FROM finish();
ROLLBACK;
