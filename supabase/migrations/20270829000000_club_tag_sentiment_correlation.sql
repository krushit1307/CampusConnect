-- Migration: 20270829000000_club_tag_sentiment_correlation.sql
-- Description: Develop a 'Dynamic "Club Tag" Sentiment Correlation' (#4527)
-- Builds a statistical correlation engine linking event taxonomy tags to
-- post-event survey ratings, with a minimum sample size gate.

-- 1. Materialized View: tag_sentiment_rankings
--    Aggregates avg rating per tag path with review count.
--    Requires >= 100 reviews to qualify (prevents skewed data from rare events).
CREATE MATERIALIZED VIEW IF NOT EXISTS public.tag_sentiment_rankings AS
SELECT
    et.tag_path::TEXT                          AS tag_path,
    COUNT(ef.id)                               AS review_count,
    ROUND(AVG(ef.rating)::NUMERIC, 2)          AS avg_rating,
    MIN(ef.rating)                             AS min_rating,
    MAX(ef.rating)                             AS max_rating,
    STDDEV(ef.rating)::NUMERIC(10, 4)          AS rating_stddev,
    CASE
        WHEN ROUND(AVG(ef.rating)::NUMERIC, 2) >= 4.5 THEN 'Very High Satisfaction'
        WHEN ROUND(AVG(ef.rating)::NUMERIC, 2) >= 4.0 THEN 'High Satisfaction'
        WHEN ROUND(AVG(ef.rating)::NUMERIC, 2) >= 3.5 THEN 'Moderate Satisfaction'
        WHEN ROUND(AVG(ef.rating)::NUMERIC, 2) >= 3.0 THEN 'Low Satisfaction'
        ELSE 'Very Low Satisfaction'
    END                                        AS sentiment_label,
    NOW()                                      AS last_refreshed_at
FROM public.event_tags et
JOIN public.event_feedback ef
    ON ef.event_id = et.event_id
WHERE ef.rating IS NOT NULL
GROUP BY et.tag_path
HAVING COUNT(ef.id) >= 100
ORDER BY avg_rating DESC;

-- Unique index enables concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_tag_sentiment_rankings_tag_path
    ON public.tag_sentiment_rankings (tag_path);

CREATE INDEX IF NOT EXISTS idx_tag_sentiment_rankings_avg
    ON public.tag_sentiment_rankings (avg_rating DESC);

-- 2. RPC: get_tag_sentiment_ranking
--    Returns ranked list of tags with sentiment statistics. Used by admin dashboard.
CREATE OR REPLACE FUNCTION public.get_tag_sentiment_ranking(
    p_min_reviews  INT     DEFAULT 100,
    p_limit        INT     DEFAULT 50,
    p_offset       INT     DEFAULT 0
)
RETURNS TABLE (
    tag_path         TEXT,
    review_count     BIGINT,
    avg_rating       NUMERIC,
    min_rating       INT,
    max_rating       INT,
    rating_stddev    NUMERIC,
    sentiment_label  TEXT,
    sentiment_rank   BIGINT,
    last_refreshed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        tsr.tag_path,
        tsr.review_count,
        tsr.avg_rating,
        tsr.min_rating,
        tsr.max_rating,
        tsr.rating_stddev,
        tsr.sentiment_label,
        ROW_NUMBER() OVER (ORDER BY tsr.avg_rating DESC) AS sentiment_rank,
        tsr.last_refreshed_at
    FROM public.tag_sentiment_rankings tsr
    WHERE tsr.review_count >= p_min_reviews
    ORDER BY tsr.avg_rating DESC
    LIMIT  p_limit
    OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_tag_sentiment_ranking(INT, INT, INT) TO authenticated;

-- 3. RPC: suggest_tags_for_event
--    Suggests the top N highest-sentiment tags with a "performance tip".
--    Used during event creation to guide clubs toward popular tag choices.
CREATE OR REPLACE FUNCTION public.suggest_tags_for_event(
    p_limit INT DEFAULT 5
)
RETURNS TABLE (
    tag_path       TEXT,
    avg_rating     NUMERIC,
    sentiment_label TEXT,
    tip_message    TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        tsr.tag_path,
        tsr.avg_rating,
        tsr.sentiment_label,
        '#' || replace(tsr.tag_path, '.', '/') || ' performs ' ||
        ROUND(((tsr.avg_rating - 3.0) / 3.0 * 100)::NUMERIC, 0)::TEXT ||
        '% better than average! (' || tsr.sentiment_label || ', ' ||
        tsr.review_count::TEXT || ' reviews)'
            AS tip_message
    FROM public.tag_sentiment_rankings tsr
    WHERE tsr.review_count >= 100
    ORDER BY tsr.avg_rating DESC
    LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_tags_for_event(INT) TO authenticated;

-- 4. Helper to refresh the materialized view (called periodically via pg_cron or manually)
CREATE OR REPLACE FUNCTION public.refresh_tag_sentiment_rankings()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.tag_sentiment_rankings;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_tag_sentiment_rankings() TO service_role;

COMMENT ON MATERIALIZED VIEW public.tag_sentiment_rankings IS
    'Aggregated average star rating per event tag path. Requires >= 100 reviews for statistical validity. Issue #4527.';

COMMENT ON FUNCTION public.get_tag_sentiment_ranking IS
    'Returns ranked sentiment statistics per event tag. Used by university admin dashboard. Issue #4527.';

COMMENT ON FUNCTION public.suggest_tags_for_event IS
    'Returns top-performing tags with tip messages for club event creation. Issue #4527.';
