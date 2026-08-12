-- Migration: Add get_comment_thread RPC using recursive CTE

CREATE OR REPLACE FUNCTION public.get_comment_thread(
    p_post_id UUID,
    p_parent_comment_id UUID DEFAULT NULL,
    p_max_depth INT DEFAULT 3
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
      c.parent_comment_id,
      c.created_at,
      c.deleted_at,
      1 AS depth
    FROM public.comments c
    WHERE c.post_id = p_post_id
      AND (
        (p_parent_comment_id IS NULL AND c.parent_comment_id IS NULL)
        OR (p_parent_comment_id IS NOT NULL AND c.parent_comment_id = p_parent_comment_id)
      )

    UNION ALL

    -- Recursive member
    SELECT 
      c.id,
      c.post_id,
      c.author_id,
      c.content,
      c.parent_comment_id,
      c.created_at,
      c.deleted_at,
      ct.depth + 1 AS depth
    FROM public.comments c
    INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
    WHERE ct.depth < p_max_depth
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
  ORDER BY ct.depth ASC, ct.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_comment_thread(UUID, UUID, INT) TO authenticated, anon;
