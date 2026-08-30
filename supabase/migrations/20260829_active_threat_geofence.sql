-- Enable PostGIS extension for spatial queries (geofencing)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create the table for Active Threat Geofences
CREATE TABLE active_threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    -- GEOMETRY(Polygon, 4326) stores the GPS boundaries of the Red Zone
    zone_polygon GEOMETRY(Polygon, 4326),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create a spatial index so the database can instantly check locations
CREATE INDEX active_threats_zone_idx ON active_threats USING GIST (zone_polygon);
