-- Create RPC function for geospatial and time-series venue conflict detection
CREATE OR REPLACE FUNCTION check_venue_collision(
    p_latitude NUMERIC(10, 7),
    p_longitude NUMERIC(10, 7),
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_exclude_event_id UUID DEFAULT NULL
)
RETURNS TABLE (
    conflicting_event_id UUID,
    conflicting_event_title TEXT,
    conflicting_club_name TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    distance_meters NUMERIC(8, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id AS conflicting_event_id,
        e.title AS conflicting_event_title,
        c.name AS conflicting_club_name,
        e.start_time,
        e.end_time,
        ROUND(
            (6371000 * acos(
                LEAST(1.0, GREATEST(-1.0,
                    cos(radians(p_latitude)) * cos(radians(e.latitude)) *
                    cos(radians(e.longitude) - radians(p_longitude)) +
                    sin(radians(p_latitude)) * sin(radians(e.latitude))
                ))
            ))::numeric, 2
        ) AS distance_meters
    FROM events e
    JOIN clubs c ON c.id = e.club_id
    WHERE (p_exclude_event_id IS NULL OR e.id != p_exclude_event_id)
      -- Time window overlap check (start +/- 2 hours buffer)
      AND e.start_time < (p_end_time + INTERVAL '2 hours')
      AND e.end_time > (p_start_time - INTERVAL '2 hours')
      -- Proximity distance threshold under 50 meters
      AND (
        6371000 * acos(
            LEAST(1.0, GREATEST(-1.0,
                cos(radians(p_latitude)) * cos(radians(e.latitude)) *
                cos(radians(e.longitude) - radians(p_longitude)) +
                sin(radians(p_latitude)) * sin(radians(e.latitude))
            ))
        )
      ) <= 50.0
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;