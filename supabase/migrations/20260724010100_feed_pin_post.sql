-- Update posts table column from pinned to is_pinned
ALTER TABLE public.posts RENAME COLUMN pinned TO is_pinned;

-- Update the post pin checking function to reference is_pinned
CREATE OR REPLACE FUNCTION public.check_post_pin_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_pinned = TRUE THEN
    -- Verify the user is an admin of the corresponding club or the club owner
    IF NOT (
      public.is_club_admin(NEW.club_id, auth.uid()) OR
      EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = NEW.club_id AND created_by = auth.uid()
      )
    ) THEN
      RAISE EXCEPTION 'Only club administrators can pin posts.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trending_posts materialized view to capture column changes
DROP MATERIALIZED VIEW IF EXISTS public.trending_posts CASCADE;

CREATE MATERIALIZED VIEW public.trending_posts AS
SELECT
    p.*,
    (
        (COALESCE(lc.like_count, 0) + COALESCE(cc.comment_count, 0) * 2)::numeric
        /
        POWER(
            ((EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600) + 2),
            1.5
        )
    ) AS hotness_score
FROM public.posts p
LEFT JOIN (
    SELECT post_id, COUNT(*) as like_count
    FROM public.post_reactions
    GROUP BY post_id
) lc ON p.id = lc.post_id
LEFT JOIN (
    SELECT post_id, COUNT(*) as comment_count
    FROM public.comments
    GROUP BY post_id
) cc ON p.id = cc.post_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_posts_id ON public.trending_posts(id);
CREATE INDEX IF NOT EXISTS idx_trending_posts_hotness ON public.trending_posts(hotness_score DESC);
