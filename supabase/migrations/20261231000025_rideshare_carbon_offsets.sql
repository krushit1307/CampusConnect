-- =============================================================================
-- Migration: 20261231000025_rideshare_carbon_offsets.sql
-- Issue: #3936 - Develop a 'Dynamic Ride-Share Carbon Offset' Calculator
-- Description: Tables for logging verified carpool carbon offsets, club ecological
--              scores, and aggregation RPC functions.
-- =============================================================================

-- 1. Rideshare Carbon Offsets Log Table
CREATE TABLE IF NOT EXISTS public.rideshare_carbon_offsets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    origin_lat NUMERIC(9, 6) NOT NULL,
    origin_lon NUMERIC(9, 6) NOT NULL,
    origin_label TEXT,
    dest_lat NUMERIC(9, 6) NOT NULL,
    dest_lon NUMERIC(9, 6) NOT NULL,
    dest_label TEXT,
    distance_miles NUMERIC(8, 2) NOT NULL,
    rider_count INT NOT NULL DEFAULT 1,
    vehicle_type TEXT NOT NULL DEFAULT 'gasoline_sedan',
    co2_saved_grams NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    co2_saved_kg NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_rideshare_carbon_offsets_club_id ON public.rideshare_carbon_offsets(club_id);
CREATE INDEX IF NOT EXISTS idx_rideshare_carbon_offsets_driver_id ON public.rideshare_carbon_offsets(driver_id);
CREATE INDEX IF NOT EXISTS idx_rideshare_carbon_offsets_event_id ON public.rideshare_carbon_offsets(event_id);

-- 2. Row Level Security
ALTER TABLE public.rideshare_carbon_offsets ENABLE ROW LEVEL SECURITY;

-- Allow public viewing of collective carbon savings
CREATE POLICY "Public can view verified carbon offsets"
    ON public.rideshare_carbon_offsets
    FOR SELECT
    USING (true);

-- Allow authenticated users to insert verified ride-share offsets
CREATE POLICY "Authenticated users can record carpool offsets"
    ON public.rideshare_carbon_offsets
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Stored Procedure: Global Campus Carbon Offset Aggregator
CREATE OR REPLACE FUNCTION public.get_campus_carbon_offset_summary_rpc()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_trips BIGINT;
    v_total_miles NUMERIC;
    v_total_cars BIGINT;
    v_total_co2_kg NUMERIC;
    v_result JSONB;
BEGIN
    SELECT 
        COUNT(*),
        COALESCE(SUM(distance_miles), 0),
        COALESCE(SUM(rider_count), 0),
        COALESCE(SUM(co2_saved_kg), 0)
    INTO 
        v_total_trips, v_total_miles, v_total_cars, v_total_co2_kg
    FROM public.rideshare_carbon_offsets;

    v_result := jsonb_build_object(
        'total_trips', v_total_trips,
        'total_miles_shared', v_total_miles,
        'total_cars_displaced', v_total_cars,
        'total_co2_kg', v_total_co2_kg,
        'total_co2_lbs', ROUND(v_total_co2_kg * 2.20462, 1),
        'trees_equivalent_10yr', ROUND(v_total_co2_kg * 0.0165, 1),
        'gasoline_gallons_saved', ROUND(v_total_co2_kg / 8.887, 1)
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campus_carbon_offset_summary_rpc TO authenticated, anon;
