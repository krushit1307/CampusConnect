-- ============================================================
-- Migration: 20260725000008_threaded_comments_view.sql
-- Issue: #1088
-- Description: Add parent_id column to comments and create recursive CTE view threaded_comments
-- ============================================================

-- 1. Add parent_id foreign key to comments table if missing
ALTER TABLE public.comments
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;

-- Sync parent_id with parent_comment_id if parent_comment_id column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'comments' AND column_name = 'parent_comment_id'
  ) THEN
    UPDATE public.comments SET parent_id = parent_comment_id WHERE parent_id IS NULL AND parent_comment_id IS NOT NULL;
  END IF;
END $$;

-- Create index on parent_id for efficient CTE recursive lookups
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);

-- 2. Create PostgreSQL Recursive CTE View for threaded comments
CREATE OR REPLACE VIEW public.threaded_comments AS
WITH RECURSIVE comment_tree AS (
  -- Anchor member: top-level comments (parent_id IS NULL)
  SELECT
    c.id,
    c.post_id,
    c.author_id,
    c.parent_id,
    c.content,
    c.created_at,
    c.updated_at,
    c.deleted_at,
    0 AS depth,
    ARRAY[c.id] AS path,
    c.id::text AS path_str
  FROM public.comments c
  WHERE c.parent_id IS NULL

  UNION ALL

  -- Recursive member: child comments referencing parent_id
  SELECT
    child.id,
    child.post_id,
    child.author_id,
    child.parent_id,
    child.content,
    child.created_at,
    child.updated_at,
    child.deleted_at,
    parent.depth + 1 AS depth,
    parent.path || child.id AS path,
    parent.path_str || '/' || child.id::text AS path_str
  FROM public.comments child
  JOIN comment_tree parent ON child.parent_id = parent.id
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

-- Grant access on the view
GRANT SELECT ON public.threaded_comments TO authenticated, anon;
