-- =============================================================================
-- Migration: Dynamic "Carpool" Route Optimizer
-- Issue: #4412 - Optimal multi-stop pickup routing for finalized carpool groups
-- Description:
--   Stores the optimized pickup route computed for a carpool (via Google Maps
--   Directions API 'optimizeWaypoints' or the offline heuristic fallback) so a
--   driver sees "Stop 1: Alice (North Hall) -> ... -> Final Destination" and
--   gets 1-click deep links for turn-by-turn navigation.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.carpool_optimized_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carpool_id UUID NOT NULL UNIQUE REFERENCES public.carpools(id) ON DELETE CASCADE,
    -- Ordered snapshot of pickup stops at optimization time:
    -- [{ "stopId": uuid, "riderName": str, "label": str, "lat": num, "lng": num }, ...]
    ordered_stops JSONB NOT NULL DEFAULT '[]'::jsonb,
    origin JSONB NOT NULL DEFAULT '{}'::jsonb,
    destination JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider TEXT NOT NULL DEFAULT 'heuristic' CHECK (provider IN ('google', 'heuristic')),
    total_distance_meters INT NOT NULL DEFAULT 0 CHECK (total_distance_meters >= 0),
    total_duration_seconds INT NOT NULL DEFAULT 0 CHECK (total_duration_seconds >= 0),
    overview_polyline TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carpool_optimized_routes_carpool
    ON public.carpool_optimized_routes(carpool_id);

ALTER TABLE public.carpool_optimized_routes ENABLE ROW LEVEL SECURITY;

-- Everyone approved in the hosting club can view the route (riders want to
-- know their pickup order too).
CREATE POLICY "Club members can view carpool routes"
ON public.carpool_optimized_routes FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.carpools c
        JOIN public.events e ON e.id = c.event_id
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE c.id = carpool_optimized_routes.carpool_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
);

-- Only the driver may compute/save/update the route for their own carpool.
CREATE POLICY "Drivers manage their carpool routes"
ON public.carpool_optimized_routes FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.carpools c
        WHERE c.id = carpool_optimized_routes.carpool_id
        AND c.driver_user_id = auth.uid()
    )
);

CREATE POLICY "Drivers update their carpool routes"
ON public.carpool_optimized_routes FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.carpools c
        WHERE c.id = carpool_optimized_routes.carpool_id
        AND c.driver_user_id = auth.uid()
    )
);
