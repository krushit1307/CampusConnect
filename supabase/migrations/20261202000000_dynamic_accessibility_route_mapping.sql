-- Issue #3439: Dynamic Accessibility Route Mapping
-- Existing map_nodes are retained for backward compatibility and extended with
-- accessibility infrastructure nodes used by the attendee-facing overlay.

ALTER TABLE public.map_nodes
  ADD COLUMN IF NOT EXISTS accessibility_notes TEXT;

ALTER TABLE public.map_nodes
  DROP CONSTRAINT IF EXISTS map_nodes_type_check;

ALTER TABLE public.map_nodes
  ADD CONSTRAINT map_nodes_type_check
  CHECK (type IN (
    'table',
    'stage',
    'boundary',
    'booth',
    'sponsor',
    'entrance',
    'elevator',
    'ramp',
    'restroom'
  ));

CREATE INDEX IF NOT EXISTS idx_map_nodes_accessibility
  ON public.map_nodes (map_id, type)
  WHERE type IN ('entrance', 'elevator', 'ramp', 'restroom');

COMMENT ON COLUMN public.map_nodes.accessibility_notes IS
  'Optional directions or caveats narrated by screen readers in Accessibility Mode. Issue #3439.';
