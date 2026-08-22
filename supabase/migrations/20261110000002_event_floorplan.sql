-- =============================================================================
-- Migration: Interactive "Event Layout" Floorplan Creator
-- Issue: #3675 - Build an 'Interactive "Event Layout" Floorplan Creator'
-- Description: Persists the serialized floorplan canvas (assets + positions)
-- on the events table and ensures venues expose physical bounds + fire exits.
-- =============================================================================

-- 1. Serialized canvas JSON: { assets: [...], updatedAt }
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS floorplan_json JSONB;

COMMENT ON COLUMN public.events.floorplan_json IS
  'Serialized 2D floorplan: draggable assets (tables, stages) in feet coordinates.';

-- 2. Venue physical bounds + fire exit definitions (used for collision checks)
ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS width_ft NUMERIC NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS height_ft NUMERIC NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS fire_exits JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN public.venues.fire_exits IS
  'Array of { x_ft, y_ft, side } describing fire exit doors; 6ft clearance pathways are derived from these.';

CREATE INDEX IF NOT EXISTS idx_events_floorplan
ON public.events USING GIN (floorplan_json)
WHERE floorplan_json IS NOT NULL;
