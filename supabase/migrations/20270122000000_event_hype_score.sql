-- Create an index to support fast time-range filtering on RSVPs
CREATE INDEX IF NOT EXISTS idx_event_rsvps_created_at_event 
ON event_rsvps (event_id, created_at DESC);

-- Postgres Function to compute dynamic event momentum
CREATE OR REPLACE FUNCTION get_trending_events_by_hype()
RETURNS TABLE (
    event_id UUID,
    title VARCHAR,
    capacity INT,
    total_rsvps BIGINT,
    recent_rsvps BIGINT,
    hype_score NUMERIC,
    is_trending BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id AS event_id,
        e.title,
        e.capacity,
        COUNT(all_rsvps.id) AS total_rsvps,
        COUNT(recent_rsvps.id) AS recent_rsvps,
        -- Calculate velocity: (Recent RSVPs / Capacity) * 100 rounded to 1 decimal place
        ROUND(
            (COUNT(recent_rsvps.id)::NUMERIC / COALESCE(NULLIF(e.capacity, 0), 1)::NUMERIC) * 100, 
            1
        ) AS hype_score,
        -- Acceptance Criteria: Trending true if >20% sold in 4h AND total recent RSVPs > 5 (filters out micro-events)
        (
            COUNT(recent_rsvps.id)::NUMERIC / COALESCE(NULLIF(e.capacity, 0), 1)::NUMERIC >= 0.20 
            AND COUNT(recent_rsvps.id) >= 5
        ) AS is_trending
    FROM events e
    LEFT JOIN event_rsvps all_rsvps ON e.id = all_rsvps.event_id
    LEFT JOIN event_rsvps recent_rsvps ON e.id = recent_rsvps.event_id 
        AND recent_rsvps.created_at >= NOW() - INTERVAL '4 hours'
    WHERE e.end_time > NOW() -- Only look up upcoming or active events
    GROUP BY e.id, e.title, e.capacity
    ORDER BY hype_score DESC, total_rsvps DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
