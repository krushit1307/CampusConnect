-- ============================================================
-- Migration: 20260730120000_postgis_geospatial_location.sql
-- Description: Enable PostGIS extension, add GEOGRAPHY location_geo column,
--              create spatial GiST index, and add get_events_nearby RPC.
-- Issue: #1860 - PostGIS extensions for advanced geospatial queries
-- ============================================================

BEGIN;

-- 1. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add location_geo column of type GEOGRAPHY(Point, 4326) to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location_geo GEOGRAPHY(Point, 4326);

-- 3. Backfill location_geo column using existing float latitude and longitude columns
UPDATE public.events
SET location_geo = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 4. Create trigger function to keep location_geo in sync with latitude and longitude updates
CREATE OR REPLACE FUNCTION public.sync_events_location_geo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.location_geo := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    ELSE
        NEW.location_geo := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_events_location_geo ON public.events;
CREATE TRIGGER trg_sync_events_location_geo
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.sync_events_location_geo();

-- 5. Add spatial index (GiST) on location_geo column for fast radius filtering
CREATE INDEX IF NOT EXISTS idx_events_location_geo_gist
ON public.events
USING GIST (location_geo);

-- 6. RPC Endpoint: get_events_nearby(user_lat, user_lng, radius_meters)
-- Returns events strictly within radius_meters of (user_lat, user_lng) ordered by distance.
CREATE OR REPLACE FUNCTION public.get_events_nearby(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION DEFAULT 8046.72
)
RETURNS TABLE (
    id UUID,
    club_id UUID,
    category_id UUID,
    title TEXT,
    description TEXT,
    banner_url TEXT,
    event_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    max_attendees INTEGER,
    available_spots INTEGER,
    status TEXT,
    created_at TIMESTAMPTZ,
    distance_meters DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_geo GEOGRAPHY := ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography;
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.club_id,
        e.category_id,
        e.title,
        e.description,
        e.banner_url,
        e.event_date,
        e.start_date,
        e.end_date,
        e.location,
        e.latitude,
        e.longitude,
        e.max_attendees,
        e.available_spots,
        e.status,
        e.created_at,
        ST_Distance(
            COALESCE(e.location_geo, ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography),
            user_geo
        ) AS distance_meters
    FROM public.events e
    WHERE (e.location_geo IS NOT NULL OR (e.latitude IS NOT NULL AND e.longitude IS NOT NULL))
      AND ST_DWithin(
          COALESCE(e.location_geo, ST_SetSRID(ST_MakePoint(e.longitude, e.latitude), 4326)::geography),
          user_geo,
          radius_meters
      )
    ORDER BY distance_meters ASC;
END;
$$;

-- 7. Grant execute permissions to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.get_events_nearby(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, anon;

COMMIT;
