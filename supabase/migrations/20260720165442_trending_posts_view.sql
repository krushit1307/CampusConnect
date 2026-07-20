-- Create materialized view for trending posts
DROP MATERIALIZED VIEW IF EXISTS trending_posts;

CREATE MATERIALIZED VIEW trending_posts AS
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
FROM posts p
LEFT JOIN (
    SELECT post_id, COUNT(*) as like_count
    FROM post_reactions
    GROUP BY post_id
) lc ON p.id = lc.post_id
LEFT JOIN (
    SELECT post_id, COUNT(*) as comment_count
    FROM comments
    GROUP BY post_id
) cc ON p.id = cc.post_id;

-- Indexes for fast sorting and lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_posts_id
ON trending_posts(id);

CREATE INDEX IF NOT EXISTS idx_trending_posts_hotness
ON trending_posts(hotness_score DESC);

-- Refresh Function (Recommended)
-- Materialized views do not update automatically.
CREATE OR REPLACE FUNCTION refresh_trending_posts()
RETURNS void
LANGUAGE sql
AS $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY trending_posts;
$$;

-- Optional pg_cron Refresh
-- If the project uses pg_cron, uncomment the following lines:
-- SELECT cron.schedule(
--     'refresh-trending-posts',
--     '*/15 * * * *',
--     $$REFRESH MATERIALIZED VIEW CONCURRENTLY trending_posts;$$
-- );
