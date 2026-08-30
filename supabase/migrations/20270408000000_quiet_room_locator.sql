-- =============================================================================
-- Issue #4729 - Dynamic "Mental Health" Quiet Room Locator
-- Quiet_Space map node + sensory-alert ledger for 90dB / 5-minute Main Hall alerts.
-- =============================================================================

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
    'restroom',
    'Quiet_Space'
  ));

CREATE TABLE IF NOT EXISTS public.sensory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  decibels INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 5,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensory_alerts_event
  ON public.sensory_alerts (event_id, created_at DESC);

ALTER TABLE public.sensory_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Attendees can view sensory alerts" ON public.sensory_alerts;
CREATE POLICY "Attendees can view sensory alerts"
  ON public.sensory_alerts FOR SELECT TO authenticated
  USING (
    public.is_system_admin()
    OR public.is_event_organizer(event_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.event_rsvps r
      WHERE r.event_id = sensory_alerts.event_id AND r.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.sensory_alerts TO authenticated;
GRANT ALL ON public.sensory_alerts TO service_role;
