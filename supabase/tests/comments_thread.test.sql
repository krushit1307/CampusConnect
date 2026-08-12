-- Start transaction
BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(4);

-- Grant privileges to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;

-- Setup mock data
-- Create a test user in auth.users
INSERT INTO auth.users (id, email, aud, role, raw_user_meta_data)
VALUES
  ('90000000-0000-0000-0000-000000000501', 'commenter@test.com', 'authenticated', 'authenticated', '{"full_name": "Commenter User"}')
ON CONFLICT (id) DO NOTHING;

-- Populate profile handle
UPDATE public.profiles SET handle = 'commenter_user', full_name = 'Commenter User' WHERE id = '90000000-0000-0000-0000-000000000501';

-- Create a club
INSERT INTO public.clubs (id, name, slug, description, created_by)
VALUES ('90000000-0000-0000-0000-000000000502', 'Comments Club', 'comments-club', 'A club for testing comments', '90000000-0000-0000-0000-000000000501')
ON CONFLICT (id) DO NOTHING;

-- Create a post
INSERT INTO public.posts (id, club_id, author_id, content)
VALUES (
  '90000000-0000-0000-0000-000000000503',
  '90000000-0000-0000-0000-000000000502',
  '90000000-0000-0000-0000-000000000501',
  'Post content'
);

-- Insert nested comments
-- Level 1: Root comment
INSERT INTO public.comments (id, post_id, author_id, content, parent_comment_id, created_at)
VALUES ('90000000-0000-0000-0000-000000000504', '90000000-0000-0000-0000-000000000503', '90000000-0000-0000-0000-000000000501', 'Root Comment 1', NULL, NOW() - INTERVAL '10 minutes');

-- Level 2: Child comment
INSERT INTO public.comments (id, post_id, author_id, content, parent_comment_id, created_at)
VALUES ('90000000-0000-0000-0000-000000000505', '90000000-0000-0000-0000-000000000503', '90000000-0000-0000-0000-000000000501', 'Child Comment 1', '90000000-0000-0000-0000-000000000504', NOW() - INTERVAL '8 minutes');

-- Level 3: Grandchild comment
INSERT INTO public.comments (id, post_id, author_id, content, parent_comment_id, created_at)
VALUES ('90000000-0000-0000-0000-000000000506', '90000000-0000-0000-0000-000000000503', '90000000-0000-0000-0000-000000000501', 'Grandchild Comment 1', '90000000-0000-0000-0000-000000000505', NOW() - INTERVAL '6 minutes');

-- Level 4: Great-grandchild comment (exceeds max_depth = 3)
INSERT INTO public.comments (id, post_id, author_id, content, parent_comment_id, created_at)
VALUES ('90000000-0000-0000-0000-000000000507', '90000000-0000-0000-0000-000000000503', '90000000-0000-0000-0000-000000000501', 'Great-grandchild Comment 1', '90000000-0000-0000-0000-000000000506', NOW() - INTERVAL '4 minutes');


-- ==========================================
-- Test Case 1: get_comment_thread returns all elements up to max_depth
-- ==========================================
SELECT results_eq(
  $$SELECT content, depth FROM public.get_comment_thread('90000000-0000-0000-0000-000000000503', NULL, 3)$$,
  $$VALUES 
    ('Root Comment 1', 1),
    ('Child Comment 1', 2),
    ('Grandchild Comment 1', 3)
  $$,
  'Should retrieve root, child, and grandchild comments with correct depths'
);

-- ==========================================
-- Test Case 2: get_comment_thread limits elements to max_depth
-- ==========================================
SELECT is_empty(
  $$SELECT 1 FROM public.get_comment_thread('90000000-0000-0000-0000-000000000503', NULL, 3) WHERE content = 'Great-grandchild Comment 1'$$,
  'Great-grandchild comment should be excluded when max_depth = 3'
);

-- ==========================================
-- Test Case 3: get_comment_thread returns deep comments when max_depth is increased
-- ==========================================
SELECT results_eq(
  $$SELECT content, depth FROM public.get_comment_thread('90000000-0000-0000-0000-000000000503', NULL, 4) WHERE depth = 4$$,
  $$VALUES ('Great-grandchild Comment 1', 4)$$,
  'Should retrieve great-grandchild comment when max_depth is increased to 4'
);

-- ==========================================
-- Test Case 4: get_comment_thread works when starting from a specific parent node
-- ==========================================
SELECT results_eq(
  $$SELECT content, depth FROM public.get_comment_thread('90000000-0000-0000-0000-000000000503', '90000000-0000-0000-0000-000000000504', 2)$$,
  $$VALUES 
    ('Child Comment 1', 1),
    ('Grandchild Comment 1', 2)
  $$,
  'Should retrieve child and grandchild comments when querying with Root Comment 1 as parent'
);

-- Finish the tests
SELECT * FROM finish();
ROLLBACK;
