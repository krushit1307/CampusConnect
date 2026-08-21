-- Migration: 20260725000000_create_club_stats_materialized_view.sql
-- Description: Create Materialized View for heavy Club Statistics and schedule automatic refresh via pg_cron (#1106)

-- 1. Create the Materialized View for Club Statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS club_stats AS
SELECT
  c.id AS club_id,
  COALESCE(COUNT(DISTINCT cm.user_id), 0)::bigint AS total_members,
  COALESCE(COUNT(DISTINCT e.id), 0)::bigint AS total_events,
  COALESCE(COUNT(DISTINCT p.id), 0)::bigint AS total_posts,
  NOW() AS refreshed_at
FROM clubs c
LEFT JOIN club_members cm ON cm.club_id = c.id
LEFT JOIN events e ON e.club_id = c.id
LEFT JOIN posts p ON p.club_id = c.id AND p.deleted_at IS NULL
GROUP BY c.id;

-- 2. Create a UNIQUE INDEX on club_id to allow CONCURRENTLY refreshing
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_stats_club_id ON club_stats (club_id);

-- 3. Grant SELECT permissions on club_stats to authenticated and anon roles
GRANT SELECT ON club_stats TO authenticated, anon;

-- 4. Create RPC helper function to fetch pre-computed club statistics
CREATE OR REPLACE FUNCTION get_club_stats(p_club_id UUID)
RETURNS TABLE (
  club_id UUID,
  total_members BIGINT,
  total_events BIGINT,
  total_posts BIGINT,
  refreshed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    cs.club_id,
    cs.total_members,
    cs.total_events,
    cs.total_posts,
    cs.refreshed_at
  FROM club_stats cs
  WHERE cs.club_id = p_club_id;
$$;

GRANT EXECUTE ON FUNCTION get_club_stats(UUID) TO authenticated, anon;

-- 5. Schedule pg_cron job to REFRESH MATERIALIZED VIEW CONCURRENTLY every 15 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh_club_stats_every_15min',
      '*/15 * * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY club_stats;'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not active or permission restricted; skipping cron schedule.';
END $$;
