-- Migration: Dynamic Commute Time RSVP Warning System
-- Addresses Issue #3942

CREATE TABLE IF NOT EXISTS public.venue_geolocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_name VARCHAR(255) NOT NULL UNIQUE,
    campus_zone VARCHAR(100) NOT NULL DEFAULT 'Main Campus',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    building_code VARCHAR(50),
    has_bike_rack BOOLEAN DEFAULT TRUE,
    nearest_shuttle_stop VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_commute_preferences (
    user_id UUID PRIMARY KEY,
    preferred_mode VARCHAR(20) DEFAULT 'WALKING' CHECK (preferred_mode IN ('WALKING', 'BICYCLE', 'SHUTTLE', 'TRANSIT')),
    walking_speed_kmh NUMERIC(4,2) DEFAULT 4.80,
    buffer_tolerance_mins INT DEFAULT 5,
    enable_push_warning BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rsvp_commute_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    target_event_id UUID NOT NULL,
    conflicting_event_id UUID NOT NULL,
    transit_duration_mins INT NOT NULL,
    available_gap_mins INT NOT NULL,
    time_deficit_mins INT NOT NULL,
    transport_mode VARCHAR(20) NOT NULL,
    user_decision VARCHAR(50) DEFAULT 'WARNED' CHECK (user_decision IN ('WARNED', 'OVERRIDDEN', 'CANCELLED', 'SWITCHED_MODE')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed campus venue landmarks for geospatial navigation
INSERT INTO public.venue_geolocations (venue_name, campus_zone, latitude, longitude, building_code, nearest_shuttle_stop)
VALUES 
    ('North Campus Engineering Hall', 'North Campus', 41.7082, -86.2365, 'ENG-NORTH', 'Stop 1: North Gate'),
    ('South Campus Arts Center', 'South Campus', 41.6934, -86.2389, 'ARTS-SOUTH', 'Stop 8: South Performing Arts'),
    ('Central Library Plaza', 'Central Campus', 41.7015, -86.2358, 'LIB-MAIN', 'Stop 4: Hesburgh Quad'),
    ('Joyce Athletic Arena', 'East Campus', 41.6980, -86.2290, 'JACC-ARENA', 'Stop 6: Stadium East')
ON CONFLICT (venue_name) DO UPDATE 
SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_commute_warnings_user ON public.rsvp_commute_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_venue_geo_coords ON public.venue_geolocations(latitude, longitude);

-- RLS
ALTER TABLE public.venue_geolocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_commute_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvp_commute_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for venue geolocations" ON public.venue_geolocations FOR SELECT USING (true);
CREATE POLICY "Users can manage commute preferences" ON public.user_commute_preferences
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view and record commute warnings" ON public.rsvp_commute_warnings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Stored procedure to detect spatial-temporal RSVP commute conflicts
CREATE OR REPLACE FUNCTION public.check_rsvp_commute_conflict(
    p_user_id UUID,
    p_target_event_start TIMESTAMPTZ,
    p_target_event_end TIMESTAMPTZ,
    p_target_lat DOUBLE PRECISION,
    p_target_lng DOUBLE PRECISION
)
RETURNS TABLE (
    adjacent_event_id UUID,
    adjacent_title TEXT,
    adjacent_lat DOUBLE PRECISION,
    adjacent_lng DOUBLE PRECISION,
    gap_minutes INT,
    estimated_walk_minutes INT,
    is_conflict BOOLEAN
) AS $$
BEGIN
    -- Query user's existing RSVPs around the target time window (+/- 60 mins)
    RETURN QUERY
    SELECT 
        e.id AS adjacent_event_id,
        e.title::TEXT AS adjacent_title,
        COALESCE(e.latitude, v.latitude, 41.7000) AS adjacent_lat,
        COALESCE(e.longitude, v.longitude, -86.2350) AS adjacent_lng,
        ROUND(EXTRACT(EPOCH FROM (p_target_event_start - e.end_date)) / 60)::INT AS gap_minutes,
        CEIL((6371 * 2 * ASIN(SQRT(
            POWER(SIN(RADIANS(p_target_lat - COALESCE(e.latitude, v.latitude, 41.7000)) / 2), 2) +
            COS(RADIANS(COALESCE(e.latitude, v.latitude, 41.7000))) * COS(RADIANS(p_target_lat)) *
            POWER(SIN(RADIANS(p_target_lng - COALESCE(e.longitude, v.longitude, -86.2350)) / 2), 2)
        )) / 4.8) * 60)::INT AS estimated_walk_minutes,
        (
            CEIL((6371 * 2 * ASIN(SQRT(
                POWER(SIN(RADIANS(p_target_lat - COALESCE(e.latitude, v.latitude, 41.7000)) / 2), 2) +
                COS(RADIANS(COALESCE(e.latitude, v.latitude, 41.7000))) * COS(RADIANS(p_target_lat)) *
                POWER(SIN(RADIANS(p_target_lng - COALESCE(e.longitude, v.longitude, -86.2350)) / 2), 2)
            )) / 4.8) * 60) > ROUND(EXTRACT(EPOCH FROM (p_target_event_start - e.end_date)) / 60)
        ) AS is_conflict
    FROM public.rsvps r
    JOIN public.events e ON e.id = r.event_id
    LEFT JOIN public.venue_geolocations v ON v.venue_name = e.location
    WHERE r.user_id = p_user_id
      AND r.status = 'CONFIRMED'
      AND e.end_date <= p_target_event_start
      AND e.end_date >= (p_target_event_start - INTERVAL '60 minutes');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
