-- Migration: Event Popularity Score Function
-- Description: Creates a custom SQL function to compute a unified popularity score 
-- natively in the database, considering RSVPs, views, and recency.

-- Step 1: Create the popularity score calculation function
CREATE OR REPLACE FUNCTION public.get_event_popularity_score(
    p_event_id UUID,
    p_event_date TIMESTAMPTZ,
    p_rsvp_count BIGINT,
    p_views INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_rsvp_score NUMERIC;
    v_view_score NUMERIC;
    v_recency_score NUMERIC;
    v_days_until_event INTEGER;
    v_total_score NUMERIC;
BEGIN
    -- 1. RSVP Score: Weighted heavily as it indicates strong intent (Weight: 5)
    v_rsvp_score := p_rsvp_count * 5.0;

    -- 2. View Score: Indicates interest, but less weighted than RSVPs (Weight: 1)
    v_view_score := p_views * 1.0;

    -- 3. Recency Score: Events happening sooner get a boost.
    -- Calculate days until the event. If the event is in the past, recency score is 0.
    v_days_until_event := EXTRACT(DAY FROM (p_event_date - NOW()));
    
    IF v_days_until_event <= 0 THEN
        v_recency_score := 0;
    ELSIF v_days_until_event <= 7 THEN
        -- High boost for events within a week
        v_recency_score := 100.0;
    ELSIF v_days_until_event <= 30 THEN
        -- Moderate boost for events within a month, decaying linearly
        v_recency_score := 100.0 - ((v_days_until_event - 7) * 3.0);
    ELSE
        -- Minimal boost for events further out
        v_recency_score := 10.0;
    END IF;

    -- 4. Calculate Total Score
    v_total_score := v_rsvp_score + v_view_score + v_recency_score;

    RETURN ROUND(v_total_score, 2);
END;
$$;

-- Step 2: Create a view or RPC to allow ordering by this score
-- We use a SQL function that returns a table to allow easy integration with Supabase RPC calls.
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
            COALESCE(r.rsvp_count, 0), 
            e.views
        ) AS popularity_score
    FROM public.events e
    LEFT JOIN (
        SELECT event_id, COUNT(*) AS rsvp_count
        FROM public.event_rsvps
        GROUP BY event_id
    ) r ON e.id = r.event_id
    WHERE e.event_date >= NOW() -- Only future or current events
      AND e.status != 'canceled'
    ORDER BY popularity_score DESC
    LIMIT p_limit
    OFFSET p_offset;
$$;

-- Step 3: Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_event_popularity_score(UUID, TIMESTAMPTZ, BIGINT, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_trending_events(INTEGER, INTEGER) TO authenticated, anon;

COMMENT ON FUNCTION public.get_event_popularity_score IS 'Calculates a unified popularity score for an event based on RSVPs, views, and recency.';
COMMENT ON FUNCTION public.get_trending_events IS 'Returns a list of events ordered by their calculated popularity score in descending order.';
