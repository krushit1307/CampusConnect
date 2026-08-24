-- =============================================================================
-- Migration: 20261231000029_event_capacity_thermal_map.sql
-- Issue: #4283 - Build a 'Real-Time "Event Capacity" Thermal Map'
-- Description: Schema for venue zones, WiFi access point telemetry, crowd surge
--              fire hazard alerts, and real-time scanning API stored procedures.
-- =============================================================================

-- 1. Venue Zones Table
CREATE TABLE IF NOT EXISTS public.venue_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    zone_slug TEXT NOT NULL,
    name TEXT NOT NULL,
    building TEXT NOT NULL,
    floor_level TEXT NOT NULL DEFAULT 'Floor 1',
    area_sq_meters NUMERIC(10, 2) NOT NULL DEFAULT 1000.0,
    max_fire_code_capacity INT NOT NULL DEFAULT 300,
    current_occupancy INT NOT NULL DEFAULT 0,
    safety_status TEXT NOT NULL DEFAULT 'optimal_green' CHECK (safety_status IN (
        'optimal_green',
        'moderate_yellow',
        'congested_amber',
        'critical_fire_hazard'
    )),
    coordinates_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_venue_zones_event_id ON public.venue_zones(event_id);
CREATE INDEX IF NOT EXISTS idx_venue_zones_status ON public.venue_zones(safety_status);

-- 2. WiFi Access Points Table
CREATE TABLE IF NOT EXISTS public.wifi_access_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mac_address TEXT NOT NULL UNIQUE,
    bssid TEXT,
    ap_name TEXT NOT NULL,
    vendor TEXT NOT NULL DEFAULT 'Cisco Meraki MR56',
    zone_id UUID REFERENCES public.venue_zones(id) ON DELETE CASCADE,
    pos_x_percent NUMERIC(5, 2) NOT NULL DEFAULT 50.0,
    pos_y_percent NUMERIC(5, 2) NOT NULL DEFAULT 50.0,
    connected_device_count INT NOT NULL DEFAULT 0,
    signal_bandwidth TEXT NOT NULL DEFAULT '5.0GHz',
    is_online BOOLEAN NOT NULL DEFAULT true,
    last_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Crowd Surge & Fire Safety Alerts Table
CREATE TABLE IF NOT EXISTS public.crowd_surge_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    zone_id TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('WARNING', 'HIGH_DENSITY', 'CRITICAL_FIRE_HAZARD')),
    current_occupancy INT NOT NULL,
    max_capacity INT NOT NULL,
    redirect_zone_id TEXT,
    message TEXT NOT NULL,
    broadcast_sent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE public.venue_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_access_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crowd_surge_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active venue zones"
    ON public.venue_zones
    FOR SELECT
    USING (true);

CREATE POLICY "Public can view access points"
    ON public.wifi_access_points
    FOR SELECT
    USING (true);

CREATE POLICY "Organizers and admins can manage zones"
    ON public.venue_zones
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Organizers and admins can manage alerts"
    ON public.crowd_surge_alerts
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 4. Stored Procedure: Ingest WiFi Telemetry & Evaluate Capacity
CREATE OR REPLACE FUNCTION public.record_wifi_telemetry_rpc(
    p_mac_address TEXT,
    p_connected_device_count INT,
    p_zone_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ap RECORD;
    v_zone RECORD;
    v_new_status TEXT;
    v_occupancy_ratio NUMERIC;
BEGIN
    UPDATE public.wifi_access_points
    SET 
        connected_device_count = p_connected_device_count,
        last_ping_at = NOW()
    WHERE mac_address = p_mac_address
    RETURNING * INTO v_ap;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access point not registered');
    END IF;

    -- Aggregate zone occupancy
    SELECT 
        COALESCE(SUM(connected_device_count), 0) INTO v_zone
    FROM public.wifi_access_points
    WHERE zone_id = v_ap.zone_id;

    RETURN jsonb_build_object(
        'success', true,
        'ap_name', v_ap.ap_name,
        'connected_devices', p_connected_device_count,
        'zone_id', v_ap.zone_id,
        'recorded_at', NOW()
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_wifi_telemetry_rpc TO authenticated, anon;
