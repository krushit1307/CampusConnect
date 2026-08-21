-- Enable PostGIS extension for high-performance spatial geographic queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create Audio Milestones Table
CREATE TABLE audio_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location GEOGRAPHY(Point, 4326) NOT NULL, -- Point geometry tracking (Longitude, Latitude)
    trigger_radius NUMERIC DEFAULT 20 NOT NULL, -- In meters, defaults to 20m per spec
    audio_file_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for high-speed spatial proximity lookups
CREATE INDEX idx_milestones_geography ON audio_milestones USING GIST(location);

-- Helpful RPC function to query milestones sorted by proximity to current user coordinates
CREATE OR REPLACE FUNCTION get_nearby_milestones(user_lon NUMERIC, user_lat NUMERIC, max_distance_meters NUMERIC)
RETURNS TABLE (
    id UUID,
    title VARCHAR,
    description TEXT,
    longitude NUMERIC,
    latitude NUMERIC,
    trigger_radius NUMERIC,
    audio_file_url TEXT,
    distance_meters NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.title,
        m.description,
        ST_X(m.location::geometry)::NUMERIC AS longitude,
        ST_Y(m.location::geometry)::NUMERIC AS latitude,
        m.trigger_radius,
        m.audio_file_url,
        ST_Distance(m.location, ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography) AS distance_meters
    FROM audio_milestones m
    WHERE ST_DWithin(m.location, ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography, max_distance_meters)
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
