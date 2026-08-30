-- Function to evaluate if a user's coordinate intersects an active threat zone
CREATE OR REPLACE FUNCTION evaluate_geofence(user_lon FLOAT8, user_lat FLOAT8)
RETURNS TABLE (
    id UUID,
    description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        atz.id,
        atz.description
    FROM active_threat_zones atz
    WHERE atz.active = true
      AND ST_Intersects(
            atz.threat_area, 
            ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)
          );
END;
$$;

-- Function to evaluate if a user's coordinate intersects an active threat zone
CREATE OR REPLACE FUNCTION evaluate_geofence(user_lon FLOAT8, user_lat FLOAT8)
RETURNS TABLE (
    id UUID,
    description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        atz.id,
        atz.description
    FROM active_threat_zones atz
    WHERE atz.active = true
      AND ST_Intersects(
            atz.threat_area, 
            ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)
          );
END;
$$;
