-- Migration: 20260839000000_venue_3d_model_viewer.sql
-- Description: Interactive Venue 3D Model Viewer with spatial layout planning (#3447)

ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS model_3d_url TEXT DEFAULT NULL;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS model_format TEXT DEFAULT 'gltf';
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS spatial_layout_data JSONB DEFAULT '[]'::jsonb;

-- Index for fast venue model lookup
CREATE INDEX IF NOT EXISTS idx_venues_model_3d ON public.venues (model_3d_url) WHERE model_3d_url IS NOT NULL;

COMMENT ON COLUMN public.venues.model_3d_url IS 'URL to standard 3D web model (.gltf, .glb, .obj) for interactive WebGL spatial viewer';
COMMENT ON COLUMN public.venues.spatial_layout_data IS 'JSON array of 3D layout primitives (tables, chairs, stages) placed by organizers for event setup';
