-- Postgres function to check for overlapping event clashes using tsrange and &&
CREATE OR REPLACE FUNCTION check_event_clashes(
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_location_id TEXT,
    p_category TEXT DEFAULT NULL,
    p_exclude_event_id UUID DEFAULT NULL
)
RETURNS TABLE (
    event_id UUID,
    title TEXT,
    clash_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id AS event_id,
        e.title,
        CASE 
            WHEN e.location_id = p_location_id THEN 'HARD'
            ELSE 'SOFT'
        END AS clash_type
    FROM events e
    WHERE (p_exclude_event_id IS NULL OR e.id != p_exclude_event_id)
      AND tsrange(e.start_time, e.end_time) && tsrange(p_start_time, p_end_time)
      AND (
          e.location_id = p_location_id 
          OR (p_category IS NOT NULL AND e.category = p_category)
      );
END;
$$ LANGUAGE plpgsql STABLE;