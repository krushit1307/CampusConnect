CREATE OR REPLACE FUNCTION check_active_threats(user_lat DOUBLE PRECISION, user_lng DOUBLE PRECISION)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_in_danger BOOLEAN;
BEGIN
    -- ST_MakePoint creates the geometry point (Longitude goes first in PostGIS!)
    -- ST_SetSRID sets it to the standard GPS coordinate system (4326)
    -- ST_Intersects checks if that point is inside any active 'zone_polygon'
    
    SELECT EXISTS (
        SELECT 1
        FROM active_threats
        WHERE is_active = true
        AND ST_Intersects(
            zone_polygon,
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)
        )
    ) INTO is_in_danger;

    RETURN is_in_danger;
END;
$$;
