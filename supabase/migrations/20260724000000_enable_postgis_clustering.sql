-- ============================================================
-- Migration: 20260724000000_enable_postgis_clustering.sql
-- Description:
-- Enables PostGIS extension for geospatial clustering of events
-- Issue: #1057 - Build custom geospatial indexing system in PostGIS for event clustering
-- ============================================================

BEGIN;

-- 1. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Create spatial index on events table for faster geospatial queries
-- This index will speed up clustering operations significantly
CREATE INDEX IF NOT EXISTS events_spatial_index 
ON events 
USING GIST (ST_MakePoint(longitude, latitude) gist_geometry_ops_2d)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 3. Create index on event dates to filter active events quickly
CREATE INDEX IF NOT EXISTS events_active_date_idx 
ON events (start_date DESC NULLS LAST)
WHERE status = 'published' 
  AND start_date IS NOT NULL
  AND (end_date IS NULL OR end_date > NOW());

-- 4. Add function to calculate event cluster within viewport bounds
-- Uses ST_ClusterDBSCAN for density-based clustering
CREATE OR REPLACE FUNCTION public.get_event_clusters(
    p_min_lat DOUBLE PRECISION,
    p_max_lat DOUBLE PRECISION,
    p_min_lng DOUBLE PRECISION,
    p_max_lng DOUBLE PRECISION,
    p_zoom_level INTEGER DEFAULT 12,
    p_cluster_radius DOUBLE PRECISION DEFAULT 0.01
)
RETURNS TABLE (
    cluster_id INTEGER,
    event_count INTEGER,
    center_lat DOUBLE PRECISION,
    center_lng DOUBLE PRECISION,
    event_ids UUID[],
    titles TEXT[]
) 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Adjust cluster radius based on zoom level (lower zoom = larger clusters)
    p_cluster_radius := p_cluster_radius * CASE 
        WHEN p_zoom_level <= 5 THEN 4.0
        WHEN p_zoom_level <= 8 THEN 2.0
        WHEN p_zoom_level <= 10 THEN 1.0
        WHEN p_zoom_level <= 14 THEN 0.5
        ELSE 0.25
    END;

    RETURN QUERY
    WITH events_in_bounds AS (
        SELECT 
            e.id,
            e.title,
            e.latitude,
            e.longitude,
            ST_MakePoint(e.longitude, e.latitude)::geometry(Point, 4326) AS geom
        FROM events e
        WHERE e.status = 'published'
          AND e.latitude IS NOT NULL 
          AND e.longitude IS NOT NULL
          AND e.start_date IS NOT NULL
          AND (e.end_date IS NULL OR e.end_date > NOW())
          AND e.latitude BETWEEN p_min_lat AND p_max_lat
          AND e.longitude BETWEEN p_min_lng AND p_max_lng
    ),
    clustered AS (
        SELECT 
            ST_ClusterDBSCAN(geom, eps := p_cluster_radius, minpoints := 2) OVER() AS cluster_id,
            id,
            title,
            latitude,
            longitude
        FROM events_in_bounds
    )
    SELECT 
        COALESCE(c.cluster_id, -1) AS cluster_id,
        COUNT(*) AS event_count,
        AVG(c.latitude) AS center_lat,
        AVG(c.longitude) AS center_lng,
        ARRAY_AGG(c.id) AS event_ids,
        ARRAY_AGG(c.title) AS titles
    FROM clustered c
    GROUP BY COALESCE(c.cluster_id, -1)
    HAVING COUNT(*) >= 1
    ORDER BY event_count DESC;
END;
$$;

-- 5. Create function for simple point-based clustering (alternative using ST_ClusterKMeans)
CREATE OR REPLACE FUNCTION public.get_event_clusters_kmeans(
    p_min_lat DOUBLE PRECISION,
    p_max_lat DOUBLE PRECISION,
    p_min_lng DOUBLE PRECISION,
    p_max_lng DOUBLE PRECISION,
    p_num_clusters INTEGER DEFAULT 20
)
RETURNS TABLE (
    cluster_id INTEGER,
    event_count INTEGER,
    center_lat DOUBLE PRECISION,
    center_lng DOUBLE PRECISION,
    event_ids UUID[],
    titles TEXT[]
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH events_in_bounds AS (
        SELECT 
            e.id,
            e.title,
            e.latitude,
            e.longitude,
            ST_MakePoint(e.longitude, e.latitude)::geometry(Point, 4326) AS geom
        FROM events e
        WHERE e.status = 'published'
          AND e.latitude IS NOT NULL 
          AND e.longitude IS NOT NULL
          AND e.start_date IS NOT NULL
          AND (e.end_date IS NULL OR e.end_date > NOW())
          AND e.latitude BETWEEN p_min_lat AND p_max_lat
          AND e.longitude BETWEEN p_min_lng AND p_max_lng
    ),
    clustered AS (
        SELECT 
            ST_ClusterKMeans(geom, p_num_clusters) OVER() AS cluster_id,
            id,
            title,
            latitude,
            longitude
        FROM events_in_bounds
    )
    SELECT 
        c.cluster_id,
        COUNT(*) AS event_count,
        AVG(c.latitude) AS center_lat,
        AVG(c.longitude) AS center_lng,
        ARRAY_AGG(c.id) AS event_ids,
        ARRAY_AGG(c.title) AS titles
    FROM clustered c
    GROUP BY c.cluster_id
    HAVING COUNT(*) >= 1
    ORDER BY event_count DESC;
END;
$$;

-- 6. Create RPC function to get all events within bounding box (for frontend clustering)
CREATE OR REPLACE FUNCTION public.get_events_in_bounds(
    p_min_lat DOUBLE PRECISION,
    p_max_lat DOUBLE PRECISION,
    p_min_lng DOUBLE PRECISION,
    p_max_lng DOUBLE PRECISION,
    p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    club_name TEXT,
    banner_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.title,
        e.description,
        e.location,
        e.latitude,
        e.longitude,
        e.start_date,
        e.end_date,
        c.name AS club_name,
        e.banner_url
    FROM events e
    LEFT JOIN clubs c ON e.club_id = c.id
    WHERE e.status = 'published'
      AND e.latitude IS NOT NULL 
      AND e.longitude IS NOT NULL
      AND e.start_date IS NOT NULL
      AND (e.end_date IS NULL OR e.end_date > NOW())
      AND e.latitude BETWEEN p_min_lat AND p_max_lat
      AND e.longitude BETWEEN p_min_lng AND p_max_lng
    ORDER BY e.start_date ASC
    LIMIT p_limit;
END;
$$;

-- 7. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_event_clusters TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_clusters_kmeans TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_events_in_bounds TO authenticated;

-- 8. Create materialized view for event locations (for faster clustering on large datasets)
DROP MATERIALIZED VIEW IF EXISTS event_locations;
CREATE MATERIALIZED VIEW event_locations AS
SELECT 
    e.id,
    e.title,
    e.description,
    e.location,
    e.latitude,
    e.longitude,
    e.start_date,
    e.end_date,
    e.club_id,
    e.status,
    e.banner_url,
    ST_MakePoint(e.longitude, e.latitude)::geography(Point, 4326) AS location_geo
FROM events e
WHERE e.status = 'published'
  AND e.latitude IS NOT NULL 
  AND e.longitude IS NOT NULL
  AND e.start_date IS NOT NULL
  AND (e.end_date IS NULL OR e.end_date > NOW());

-- 9. Create indexes on materialized view
CREATE UNIQUE INDEX event_locations_id_idx ON event_locations(id);
CREATE INDEX event_locations_geo_idx ON event_locations USING GIST(location_geo);
CREATE INDEX event_locations_start_date_idx ON event_locations(start_date DESC NULLS LAST);

-- 10. Create function to refresh materialized view (should be called periodically)
CREATE OR REPLACE FUNCTION public.refresh_event_locations()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY event_locations;
END;
$$;

COMMIT;

-- Note: Run this to manually refresh the materialized view:
-- SELECT public.refresh_event_locations();