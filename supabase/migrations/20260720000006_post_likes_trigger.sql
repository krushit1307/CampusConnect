-- ============================================================
-- Migration: 20260720000006_post_likes_trigger.sql
-- Description:
--   Adds triggers on post_likes to keep the denormalized
--   like_count column on posts in sync automatically.
--   Updates the existing trigger function to count from
--   both post_likes and post_reactions so like_count reflects
--   total user engagement.
-- ============================================================

-- 1. Replace the trigger function to handle both tables
CREATE OR REPLACE FUNCTION public.update_post_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id UUID;
BEGIN
  v_post_id := COALESCE(NEW.post_id, OLD.post_id);

  UPDATE posts
  SET like_count = (
    (SELECT COUNT(*) FROM post_reactions WHERE post_id = v_post_id) +
    (SELECT COUNT(*) FROM post_likes WHERE post_id = v_post_id)
  )
  WHERE id = v_post_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Re-create triggers on post_reactions (function signature changed)
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

-- 3. Create triggers on post_likes
DROP TRIGGER IF EXISTS trg_post_likes_insert ON post_likes;
CREATE TRIGGER trg_post_likes_insert
AFTER INSERT ON post_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_post_like_count();

DROP TRIGGER IF EXISTS trg_post_likes_delete ON post_likes;
CREATE TRIGGER trg_post_likes_delete
AFTER DELETE ON post_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_post_like_count();

-- 4. Backfill like_count from both tables
UPDATE posts
SET like_count = (
  (SELECT COUNT(*) FROM post_reactions WHERE post_reactions.post_id = posts.id) +
  (SELECT COUNT(*) FROM post_likes WHERE post_likes.post_id = posts.id)
);
