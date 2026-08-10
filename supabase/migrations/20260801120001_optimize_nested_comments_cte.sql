-- ============================================================
-- Migration: 20260801120000_optimize_nested_comments_cte.sql
-- Issue: #1853
-- Description: Optimize recursive CTEs and indexes for fetching deeply nested comments
-- ============================================================

-- 1. Composite indexes to accelerate recursive CTE joins and depth filtering
CREATE INDEX IF NOT EXISTS idx_comments_post_parent_created
ON public.comments(post_id, parent_comment_id, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_post_parent_id
ON public.comments(post_id, parent_id, created_at);

CREATE INDEX IF NOT EXISTS idx_comments_parent_id_created
ON public.comments(parent_id, created_at);

-- 2. Optimized Threaded Comments View with depth guard and zero-padded materialized path
CREATE OR REPLACE VIEW public.threaded_comments AS
WITH RECURSIVE comment_tree AS (
  -- Anchor member: top-level comments for all posts (depth 0)
  SELECT
    c.id,
    c.post_id,
    c.author_id,
    COALESCE(c.parent_id, c.parent_comment_id) AS parent_id,
    c.content,
    c.created_at,
    c.updated_at,
    c.deleted_at,
    0 AS depth,
    ARRAY[c.id] AS path,
    TO_CHAR(c.created_at, 'YYYYMMDDHH24MISSMS') || '_' || SUBSTRING(c.id::text, 1, 8) AS path_str
  FROM public.comments c
  WHERE c.parent_id IS NULL AND c.parent_comment_id IS NULL

  UNION ALL

  -- Recursive member: child comments up to max depth 5
  SELECT
    child.id,
    child.post_id,
    child.author_id,
    COALESCE(child.parent_id, child.parent_comment_id) AS parent_id,
    child.content,
    child.created_at,
    child.updated_at,
    child.deleted_at,
    parent.depth + 1 AS depth,
    parent.path || child.id AS path,
    parent.path_str || '/' || TO_CHAR(child.created_at, 'YYYYMMDDHH24MISSMS') || '_' || SUBSTRING(child.id::text, 1, 8) AS path_str
  FROM public.comments child
  INNER JOIN comment_tree parent
    ON COALESCE(child.parent_id, child.parent_comment_id) = parent.id
  WHERE parent.depth < 5
)
SELECT
  ct.id,
  ct.post_id,
  ct.author_id,
  ct.parent_id,
  ct.content,
  ct.created_at,
  ct.updated_at,
  ct.deleted_at,
  ct.depth,
  ct.path,
  ct.path_str,
  p.full_name AS author_name,
  p.avatar_url AS author_avatar_url,
  p.handle AS author_handle,
  p.role AS author_role
FROM comment_tree ct
LEFT JOIN public.profiles p ON ct.author_id = p.id;

GRANT SELECT ON public.threaded_comments TO authenticated, anon;

-- 3. Optimized RPC Function with strict depth bounds & pagination
CREATE OR REPLACE FUNCTION public.get_comment_thread(
    p_post_id UUID,
    p_parent_comment_id UUID DEFAULT NULL,
    p_max_depth INT DEFAULT 5,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    post_id UUID,
    author_id UUID,
    author_name TEXT,
    content TEXT,
    parent_comment_id UUID,
    created_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    depth INT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH RECURSIVE comment_tree AS (
    -- Anchor member
    SELECT 
      c.id,
      c.post_id,
      c.author_id,
      c.content,
      COALESCE(c.parent_comment_id, c.parent_id) AS parent_comment_id,
      c.created_at,
      c.deleted_at,
      1 AS depth,
      TO_CHAR(c.created_at, 'YYYYMMDDHH24MISSMS') || '_' || SUBSTRING(c.id::text, 1, 8) AS path_str
    FROM public.comments c
    WHERE c.post_id = p_post_id
      AND (
        (p_parent_comment_id IS NULL AND c.parent_comment_id IS NULL AND c.parent_id IS NULL)
        OR (p_parent_comment_id IS NOT NULL AND (c.parent_comment_id = p_parent_comment_id OR c.parent_id = p_parent_comment_id))
      )

    UNION ALL

    -- Recursive member with strict depth upper boundary
    SELECT 
      c.id,
      c.post_id,
      c.author_id,
      c.content,
      COALESCE(c.parent_comment_id, c.parent_id) AS parent_comment_id,
      c.created_at,
      c.deleted_at,
      ct.depth + 1 AS depth,
      ct.path_str || '/' || TO_CHAR(c.created_at, 'YYYYMMDDHH24MISSMS') || '_' || SUBSTRING(c.id::text, 1, 8) AS path_str
    FROM public.comments c
    INNER JOIN comment_tree ct ON (c.parent_comment_id = ct.id OR c.parent_id = ct.id)
    WHERE ct.depth < LEAST(p_max_depth, 10)
  )
  SELECT 
    ct.id,
    ct.post_id,
    ct.author_id,
    p.full_name AS author_name,
    ct.content,
    ct.parent_comment_id,
    ct.created_at,
    ct.deleted_at,
    ct.depth
  FROM comment_tree ct
  LEFT JOIN public.profiles p ON p.id = ct.author_id
  ORDER BY ct.path_str ASC, ct.created_at ASC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_comment_thread(UUID, UUID, INT, INT, INT) TO authenticated, anon;
