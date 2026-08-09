-- Migration: Cache Trending Events
-- Issue: #2212
-- Description: Cache the expensive trending-event calculation in a
-- PostgreSQL materialized view and refresh it asynchronously every 5 minutes.

-- 1. Create the materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS public.trending_events AS
WITH event_rsvp_counts AS (
    SELECT
        event_id,
        COUNT(*) AS rsvp_count
    FROM public.event_rsvps
    GROUP BY event_id
)
SELECT
    e.id,
    e.title,
    e.description,
    e.event_date,
    e.banner_url,
    COALESCE(r.rsvp_count, 0)::BIGINT AS rsvp_count,
    e.views AS views_count,
    public.get_event_popularity_score(
        e.id,
        e.event_date,
        COALESCE(r.rsvp_count, 0)::INTEGER,
        e.views
    ) AS popularity_score
FROM public.events e
LEFT JOIN event_rsvp_counts r
    ON e.id = r.event_id
WHERE e.event_date >= NOW()
  AND e.status != 'canceled'
ORDER BY popularity_score DESC
LIMIT 100;

-- 2. Create the unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_events_id
    ON public.trending_events (id);

-- 3. Index the cached scores
CREATE INDEX IF NOT EXISTS idx_trending_events_score
    ON public.trending_events (popularity_score DESC);

-- 4. Allow frontend-facing roles to read the cached results
GRANT SELECT ON public.trending_events TO authenticated, anon;

-- 5. Replace the expensive RPC with a query against the materialized view
CREATE OR REPLACE FUNCTION public.get_trending_events(
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    event_date TIMESTAMPTZ,
    banner_url TEXT,
    rsvp_count BIGINT,
    views_count INTEGER,
    popularity_score NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT
        te.id,
        te.title,
        te.description,
        te.event_date,
        te.banner_url,
        te.rsvp_count,
        te.views_count,
        te.popularity_score
    FROM public.trending_events te
    ORDER BY te.popularity_score DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_events(INTEGER, INTEGER)
    TO authenticated, anon;

COMMENT ON MATERIALIZED VIEW public.trending_events IS
    'Cached top 100 trending events. Refreshed every 5 minutes.';

COMMENT ON FUNCTION public.get_trending_events(INTEGER, INTEGER) IS
    'Returns cached trending events from the trending_events materialized view.';

-- 6. Schedule the cache refresh every 5 minutes
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pg_cron'
    ) THEN
        PERFORM cron.unschedule('refresh_trending_events');

        PERFORM cron.schedule(
            'refresh_trending_events',
            '*/5 * * * *',
            'REFRESH MATERIALIZED VIEW CONCURRENTLY public.trending_events;'
        );
    ELSE
        RAISE NOTICE 'pg_cron extension not active; skipping trending refresh schedule.';
    END IF;
END;
$$;