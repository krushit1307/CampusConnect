-- ============================================================
-- Migration: 20260801130000_feed_delete_purge_trigger.sql
-- Description:
-- Purges the Redis feed page cache whenever a post is removed
-- (hard delete, or soft delete via deleted_at being set), so a
-- deleted/moderated post can't keep appearing in an already-cached
-- feed page. Mirrors the pg_net trigger pattern already used for
-- CDN purges (see docs/caching.md) and club registration webhooks.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.purge_feed_cache_on_post_removed()
RETURNS TRIGGER AS $$
DECLARE
    -- Replace with your project's actual Edge Function URL
    -- (e.g. https://<project-ref>.supabase.co/functions/v1/purge-feed-cache)
    purge_url TEXT := current_setting('app.settings.purge_feed_cache_url', true);
BEGIN
    IF purge_url IS NULL OR purge_url = '' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Hard delete, or a soft delete transitioning deleted_at from NULL -> NOT NULL
    IF (TG_OP = 'DELETE')
       OR (TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
        PERFORM net.http_post(
            url := purge_url,
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := '{}'::jsonb
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.purge_feed_cache_on_post_removed() IS
'Notifies the purge-feed-cache Edge Function when a post is deleted or soft-deleted, so cached feed pages do not serve removed content.';

DROP TRIGGER IF EXISTS on_post_deleted_purge_feed_cache ON public.posts;

CREATE TRIGGER on_post_deleted_purge_feed_cache
    AFTER DELETE OR UPDATE OF deleted_at ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.purge_feed_cache_on_post_removed();