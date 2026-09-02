-- Migration: 20260867000000_carpool_route_waypoint_optimizer.sql
-- Description: Dynamic Carpool Route Waypoint Optimizer with Google Maps Directions API integration (#4678)

CREATE TABLE IF NOT EXISTS public.carpool_route_waypoint_optimizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  carpool_id UUID NOT NULL REFERENCES public.carpools(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  venue_name TEXT NOT NULL,
  original_distance_miles NUMERIC(10, 2) NOT NULL,
  optimized_distance_miles NUMERIC(10, 2) NOT NULL,
  time_saved_minutes INT NOT NULL,
  optimized_waypoint_order JSONB NOT NULL,
  google_maps_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for carpool route optimization lookup
CREATE INDEX IF NOT EXISTS idx_carpool_route_optimizations_carpool ON public.carpool_route_waypoint_optimizations(carpool_id);

-- Enable RLS
ALTER TABLE public.carpool_route_waypoint_optimizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read carpool route optimizations"
ON public.carpool_route_waypoint_optimizations FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage carpool route optimizations"
ON public.carpool_route_waypoint_optimizations FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.carpool_route_waypoint_optimizations TO authenticated, anon;
