-- ============================================================
-- Migration: 20260720050000_post_like_count.sql
-- Description:
-- Adds a denormalized like_count column to posts and creates
-- triggers on post_reactions to keep it in sync automatically.
-- ============================================================

-- 1. Add like_count column to posts
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0;

-- 2. Create trigger function to update like_count
CREATE OR REPLACE FUNCTION public.update_post_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET like_count = (
      SELECT COUNT(*) FROM post_reactions WHERE post_id = NEW.post_id
    )
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET like_count = (
      SELECT COUNT(*) FROM post_reactions WHERE post_id = OLD.post_id
    )
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$;

-- 3. Create triggers on post_reactions
DROP TRIGGER IF EXISTS trg_post_reactions_insert ON post_reactions;
CREATE TRIGGER trg_post_reactions_insert
AFTER INSERT ON post_reactions
FOR EACH ROW
EXECUTE FUNCTION public.update_post_like_count();

DROP TRIGGER IF EXISTS trg_post_reactions_delete ON post_reactions;
CREATE TRIGGER trg_post_reactions_delete
AFTER DELETE ON post_reactions
FOR EACH ROW
EXECUTE FUNCTION public.update_post_like_count();

-- 4. Backfill existing like_count values for all posts
UPDATE posts
SET like_count = (
  SELECT COUNT(*) FROM post_reactions WHERE post_reactions.post_id = posts.id
);
