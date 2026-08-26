-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the materialized view
DROP MATERIALIZED VIEW IF EXISTS club_analytics_mat_view CASCADE;
CREATE MATERIALIZED VIEW club_analytics_mat_view AS
SELECT 
    c.id AS club_id,
    c.name AS club_name,
    COUNT(DISTINCT cm.id) AS total_members,
    COUNT(DISTINCT e.id) AS total_events
FROM 
    clubs c
LEFT JOIN 
    club_members cm ON c.id = cm.club_id AND cm.status = 'approved'
LEFT JOIN 
    events e ON c.id = e.club_id
GROUP BY 
    c.id, c.name;

-- 3. Create a UNIQUE INDEX on club_id to allow CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_analytics_mat_view_club_id ON club_analytics_mat_view(club_id);

-- 4. Grant select access to public/authenticated roles if needed
-- We assume RLS is handled at the views or functions that query this, but since it's a materialized view, 
-- we can grant select to authenticated users, or keep it for service roles. 
-- For now, grant select to authenticated and anon since it might be queried publicly.
GRANT SELECT ON club_analytics_mat_view TO authenticated, anon;

-- 5. Schedule a cron job to refresh the materialized view every 15 minutes
SELECT cron.schedule(
    'refresh_club_analytics',
    '*/15 * * * *',
    $$ REFRESH MATERIALIZED VIEW CONCURRENTLY club_analytics_mat_view; $$
);
