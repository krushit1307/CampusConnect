-- Migration: 20260727020000_refresh_trending_cron.sql
-- Description: Refresh the trending_posts materialized view concurrently using pg_cron

-- 1. Ensure a unique index exists on the materialized view
-- (This is strictly required for executing REFRESH MATERIALIZED VIEW CONCURRENTLY)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_posts_id 
ON public.trending_posts (id);

-- 2. Schedule the pg_cron job to refresh every hour
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    
    -- Unschedule old cron job if it exists (for idempotency)
    BEGIN
      PERFORM cron.unschedule('refresh_trending_posts_cron');
    EXCEPTION WHEN OTHERS THEN
      -- Ignore if it does not exist
      RAISE NOTICE 'Old cron job refresh_trending_posts_cron not found or could not be unscheduled.';
    END;

    -- Schedule new cron job to refresh every hour
    PERFORM cron.schedule(
      'refresh_trending_posts_cron',
      '0 * * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.trending_posts;'
    );

    RAISE NOTICE 'Successfully scheduled pg_cron job to refresh trending_posts concurrently.';
  ELSE
    RAISE NOTICE 'pg_cron extension not active; skipping cron scheduling.';
  END IF;
END $$;
