-- ============================================================
-- Migration: 20260804000000_recursive_comments_cte.sql
-- Issue: #2099
-- Description: Postgres recursive CTEs for infinitely nested comments
-- ============================================================

-- 1. Ensure comments table has parent_id column and index
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_post_parent_id_created
ON public.comments(post_id, parent_id, created_at);

-- 2. Create recursive function to fetch nested comments up to depth < 5
CREATE OR REPLACE FUNCTION public.get_recursive_comment_thread(
    p_post_id UUID,
    p_max_depth INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    post_id UUID,
    author_id UUID,
    parent_id UUID,
    content TEXT,
    created_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    depth INT,
    path UUID[]
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH RECURSIVE comment_tree AS (
    -- Non-recursive term: root comments for post (parent_id IS NULL)
    SELECT
      c.id,
      c.post_id,
      c.author_id,
      COALESCE(c.parent_id, c.parent_comment_id) AS parent_id,
      c.content,
      c.created_at,
      c.deleted_at,
      0 AS depth,
      ARRAY[c.id] AS path
    FROM public.comments c
    WHERE c.post_id = p_post_id
      AND c.parent_id IS NULL
      AND c.parent_comment_id IS NULL

    UNION ALL

    -- Recursive term: join comments back onto comment_tree CTE
    SELECT
      child.id,
      child.post_id,
      child.author_id,
      COALESCE(child.parent_id, child.parent_comment_id) AS parent_id,
      child.content,
      child.created_at,
      child.deleted_at,
      parent.depth + 1 AS depth,
      parent.path || child.id AS path
    FROM public.comments child
    INNER JOIN comment_tree parent
      ON COALESCE(child.parent_id, child.parent_comment_id) = parent.id
    WHERE parent.depth < LEAST(p_max_depth, 5)
  )
  SELECT
    ct.id,
    ct.post_id,
    ct.author_id,
    ct.parent_id,
    ct.content,
    ct.created_at,
    ct.deleted_at,
    ct.depth,
    ct.path
  FROM comment_tree ct
  ORDER BY ct.path ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_recursive_comment_thread(UUID, INT) TO authenticated, anon;
