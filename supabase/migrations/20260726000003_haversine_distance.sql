-- Migration: 20260726000001_haversine_distance.sql
-- Description: Add Haversine distance function and location columns for events and profiles

ALTER TABLE events
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE OR REPLACE FUNCTION haversine_distance(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    earth_radius DOUBLE PRECISION := 6371.0; -- Earth's radius in km
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    dlat := RADIANS(lat2 - lat1);
    dlon := RADIANS(lon2 - lon1);

    a := SIN(dlat / 2)^2
       + COS(RADIANS(lat1))
       * COS(RADIANS(lat2))
       * SIN(dlon / 2)^2;

    c := 2 * ATAN2(SQRT(a), SQRT(1 - a));

    RETURN earth_radius * c;
END;
$$;
