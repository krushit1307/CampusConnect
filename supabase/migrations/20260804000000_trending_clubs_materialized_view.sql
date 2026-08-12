-- =============================================================================
-- Migration: 20260804000000_trending_clubs_materialized_view.sql
-- Purpose: Implement Materialized Views for 'Trending Clubs' calculation to
--          drastically speed up homepage queries and lower database resource load.
-- =============================================================================

-- 1. Create the materialized view
CREATE MATERIALIZED VIEW public.trending_clubs AS
SELECT 
    c.id, 
    c.name, 
    c.description, 
    c.image_url, 
    c.member_count,
    COUNT(r.id) AS score
FROM public.clubs c
LEFT JOIN public.events e ON e.club_id = c.id
LEFT JOIN public.event_rsvps r ON r.event_id = e.id AND r.rsvp_at >= NOW() - INTERVAL '7 days'
GROUP BY c.id
ORDER BY score DESC;

-- 2. Create unique index for concurrent refreshes
CREATE UNIQUE INDEX idx_trending_id ON public.trending_clubs(id);

-- 3. Grant select permissions
GRANT SELECT ON public.trending_clubs TO authenticated, anon;

-- 4. Setup cron job to refresh the view every 15 minutes concurrently
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh_trending_clubs_every_15min',
      '*/15 * * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.trending_clubs;'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not active or permission restricted; skipping cron schedule.';
END $$;
