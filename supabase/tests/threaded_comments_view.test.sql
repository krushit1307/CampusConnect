-- ============================================================
-- Test Suite: threaded_comments_view.test.sql
-- Issue: #1088
-- Description: Verifies parent_id column and recursive CTE view threaded_comments
-- ============================================================

BEGIN;

-- Enable pgTAP extension
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests (4 tests)
SELECT plan(4);

-- Test 1: Column parent_id exists on comments table
SELECT has_column('public', 'comments', 'parent_id', 'Column parent_id should exist on comments table');

-- Test 2: View threaded_comments exists in public schema
SELECT has_view('public', 'threaded_comments', 'View threaded_comments should exist');

-- Setup test profile and club
INSERT INTO auth.users (id, email)
VALUES ('d0000000-0000-0000-0000-000000000001', 'thread_test@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('d0000000-0000-0000-0000-000000000002', 'Thread Club', 'thread-club', 'Test Club', 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.posts (id, club_id, author_id, content)
VALUES ('d0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Post for threaded comments')
ON CONFLICT (id) DO NOTHING;

-- Insert top-level comment (depth 0)
INSERT INTO public.comments (id, post_id, author_id, content, parent_id)
VALUES ('d0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Root Comment', NULL);

-- Insert child reply (depth 1)
INSERT INTO public.comments (id, post_id, author_id, content, parent_id)
VALUES ('d0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Nested Reply', 'd0000000-0000-0000-0000-000000000010');

-- Test 3: Top-level comment has depth = 0 in threaded_comments view
SELECT results_eq(
  $$SELECT depth FROM public.threaded_comments WHERE id = 'd0000000-0000-0000-0000-000000000010'$$,
  $$VALUES (0)$$,
  'Top level comment should have depth 0'
);

-- Test 4: Nested child reply has depth = 1 and correct parent_id in threaded_comments view
SELECT results_eq(
  $$SELECT depth, parent_id FROM public.threaded_comments WHERE id = 'd0000000-0000-0000-0000-000000000011'$$,
  $$VALUES (1, 'd0000000-0000-0000-0000-000000000010'::uuid)$$,
  'Nested reply should have depth 1 and match parent_id'
);

SELECT * FROM finish();
ROLLBACK;
