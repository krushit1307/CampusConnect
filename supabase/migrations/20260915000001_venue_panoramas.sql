-- =============================================================================
-- Migration: Interactive Venue 360-Tour Embed
-- Issue: #3232 - Build an 'Interactive Venue 360-Tour' Embed
-- Description: Adds columns to the venues table to support equirectangular 
-- panoramic images and interactive 3D hotspots (e.g., power outlets, AV gear).
-- =============================================================================

-- 1. Add panorama URL column (Points to Supabase Storage)
ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS panorama_url TEXT,
ADD COLUMN IF NOT EXISTS panorama_blur_url TEXT; -- Low-res placeholder for progressive loading

COMMENT ON COLUMN public.venues.panorama_url IS 'URL to the high-res equirectangular panorama image in Supabase Storage.';
COMMENT ON COLUMN public.venues.panorama_blur_url IS 'URL to a heavily compressed, blurred 50kb placeholder for instant loading.';

-- 2. Add Hotspots JSONB column
ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS panorama_hotspots JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.venues.panorama_hotspots IS 'Array of 3D hotspot objects: [{id, yaw, pitch, icon, title, description}]';

-- Add GIN index for fast querying of hotspots if needed
CREATE INDEX IF NOT EXISTS idx_venues_panorama_hotspots 
ON public.venues USING GIN (panorama_hotspots);

-- =============================================================================
-- Row Level Security (RLS) Updates
-- =============================================================================
-- Assuming venues table already has RLS enabled.
-- We just need to ensure the new columns are covered by existing policies.

-- Venue Managers can update the panorama URLs and hotspots
-- (Assuming an existing policy like "Venue managers can update venues" covers these new columns)

-- Create a specific RPC for updating hotspots to allow granular permission checks
CREATE OR REPLACE FUNCTION public.update_venue_hotspots(
    p_venue_id UUID,
    p_hotspots JSONB
) RETURNS VOID AS $$
BEGIN
    -- Verify the caller is a venue manager or admin
    IF NOT EXISTS (
        SELECT 1 FROM public.venue_managers vm
        WHERE vm.venue_id = p_venue_id AND vm.user_id = auth.uid()
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized to update venue hotspots';
    END IF;

    UPDATE public.venues
    SET panorama_hotspots = p_hotspots
    WHERE id = p_venue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
