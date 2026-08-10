-- Migration: 20260808000000_add_blurhash_to_posts.sql
-- Description: Adds blurhash column to posts table and extends the existing
-- trigger_generate_blurhash() function to also handle the post-attachments
-- bucket, so post images receive the same BlurHash treatment as event banners.
--
-- The existing trigger (on_event_banner_uploaded) already fires AFTER INSERT
-- ON storage.objects FOR EACH ROW for all buckets. Its body currently exits
-- early for any bucket other than 'event-banners'. We replace the function
-- body here to additionally handle 'post-attachments', while preserving all
-- existing event-banner behaviour exactly.
--
-- The Edge Function URL is read from app.settings.blurhash_function_url at
-- runtime so that no production-specific URL is hard-coded here. See the
-- project README / deployment docs for how to set this value.
-- Local dev: set via  ALTER DATABASE postgres SET "app.settings.blurhash_function_url" = ...
-- Production: set via Supabase Dashboard → Database → Settings → Custom Config

-- 1. Add blurhash column to posts (idempotent)
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS blurhash TEXT;

COMMENT ON COLUMN public.posts.blurhash IS
  'Compact BlurHash string for image placeholder rendering (populated asynchronously after upload)';

-- 2. Rebuild trending_posts materialized view so it picks up the new column.
--    Uses the same SELECT p.* pattern as the original migration so future
--    columns on posts are automatically included.
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
    SELECT post_id, COUNT(*) AS like_count
    FROM public.post_reactions
    GROUP BY post_id
) lc ON p.id = lc.post_id
LEFT JOIN (
    SELECT post_id, COUNT(*) AS comment_count
    FROM public.comments
    GROUP BY post_id
) cc ON p.id = cc.post_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_posts_id
    ON public.trending_posts (id);
CREATE INDEX IF NOT EXISTS idx_trending_posts_hotness
    ON public.trending_posts (hotness_score DESC);

-- 3. Replace trigger_generate_blurhash() to handle both event-banners AND
--    post-attachments.  All other buckets are still silently ignored.
--    The existing trigger (on_event_banner_uploaded) does not need to be
--    recreated — it already fires FOR EACH ROW on storage.objects INSERTs
--    and will pick up this updated function body automatically.
CREATE OR REPLACE FUNCTION public.trigger_generate_blurhash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url   TEXT := current_setting('app.settings.blurhash_function_url', true);
  webhook_secret TEXT := current_setting('app.settings.webhook_secret', true);
BEGIN
  -- Only process buckets that store images we want to BlurHash.
  IF NEW.bucket_id NOT IN ('event-banners', 'post-attachments') THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := COALESCE(
                 function_url,
                 -- Fallback matches the placeholder used in the original
                 -- add_blurhash_to_events migration.  The function_url setting
                 -- MUST be configured in both local and production environments
                 -- before image uploads can trigger BlurHash generation.
                 -- See deployment documentation.
                 'https://<project-ref>.supabase.co/functions/v1/generate-blurhash'
               ),
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', COALESCE(webhook_secret, '')
    ),
    body := jsonb_build_object(
      'bucket_id', NEW.bucket_id,
      'name',      NEW.name
    )
  );

  RETURN NEW;
END;
$$;
