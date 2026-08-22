-- 1. Ensure user_preferences table supports dietary restriction tags array
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[] DEFAULT '{}'::text[] NOT NULL;

-- 2. Create RPC function to aggregate dietary needs by event venue GPS coordinates
CREATE OR REPLACE FUNCTION get_dietary_restriction_heatmap_data(
    p_dietary_tag TEXT DEFAULT NULL,
    p_time_window_start TIMESTAMPTZ DEFAULT NOW(),
    p_time_window_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '4 hours')
)
RETURNS TABLE (
    venue_id UUID,
    venue_name TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    dietary_tag TEXT,
    student_count BIGINT,
    intensity_weight NUMERIC(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.venue_id,
        e.venue_name,
        e.latitude,
        e.longitude,
        unnested_tag.dietary_tag,
        COUNT(DISTINCT r.user_id) AS student_count,
        ROUND(LEAST(1.00, COUNT(DISTINCT r.user_id)::numeric / 100.00), 2) AS intensity_weight
    FROM events e
    JOIN rsvps r ON r.event_id = e.id
    JOIN user_preferences up ON up.user_id = r.user_id
    CROSS JOIN UNNEST(up.dietary_restrictions) AS unnested_tag(dietary_tag)
    WHERE r.status IN ('attending', 'attended')
      AND e.start_time <= p_time_window_end
      AND e.end_time >= p_time_window_start
      AND (p_dietary_tag IS NULL OR LOWER(unnested_tag.dietary_tag) = LOWER(p_dietary_tag))
    GROUP BY e.venue_id, e.venue_name, e.latitude, e.longitude, unnested_tag.dietary_tag;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;