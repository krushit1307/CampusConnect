-- Issue #4544: Real-time Campus Safety geofence alerts.
-- The attendee's browser keeps raw coordinates locally. Only a minimal alert
-- record is persisted after the three-minute acknowledgement window expires.

CREATE TABLE IF NOT EXISTS public.event_geofence_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
  attendee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attendee_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'escalated'
    CHECK (status IN ('escalated', 'acknowledged')),
  breached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  escalated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  distance_meters DOUBLE PRECISION,
  accuracy_meters DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_geofence_alerts_event_created
  ON public.event_geofence_alerts(event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_geofence_alerts_attendee_created
  ON public.event_geofence_alerts(attendee_id, created_at DESC);

ALTER TABLE public.event_geofence_alerts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.event_geofence_alerts FROM anon, authenticated;
GRANT SELECT ON public.event_geofence_alerts TO authenticated;
GRANT ALL ON public.event_geofence_alerts TO service_role;

DROP POLICY IF EXISTS "Organizers and attendees can read geofence alerts"
  ON public.event_geofence_alerts;
CREATE POLICY "Organizers and attendees can read geofence alerts"
  ON public.event_geofence_alerts
  FOR SELECT TO authenticated
  USING (
    attendee_id = auth.uid()
    OR public.is_event_organizer(event_id, auth.uid())
  );

CREATE OR REPLACE FUNCTION public.raise_event_geofence_alert(
  p_rsvp_id UUID,
  p_distance_meters DOUBLE PRECISION,
  p_accuracy_meters DOUBLE PRECISION DEFAULT NULL
)
RETURNS public.event_geofence_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rsvp RECORD;
  v_event RECORD;
  v_existing public.event_geofence_alerts;
  v_alert public.event_geofence_alerts;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_radius INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to raise a safety alert.' USING ERRCODE = '42501';
  END IF;

  IF p_distance_meters IS NULL OR p_distance_meters < 0 OR p_distance_meters > 1000000 THEN
    RAISE EXCEPTION 'A valid distance is required.' USING ERRCODE = '22023';
  END IF;

  IF p_accuracy_meters IS NOT NULL
     AND (p_accuracy_meters < 0 OR p_accuracy_meters > 1000000) THEN
    RAISE EXCEPTION 'A valid location accuracy is required.' USING ERRCODE = '22023';
  END IF;

  SELECT r.id, r.event_id, r.user_id, r.status
  INTO v_rsvp
  FROM public.event_rsvps r
  WHERE r.id = p_rsvp_id
    AND r.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only the attendee who owns the RSVP can raise this alert.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_rsvp.status, 'attending') IN ('cancelled', 'canceled', 'refunded', 'rejected', 'waitlisted', 'waitlist') THEN
    RAISE EXCEPTION 'Only an active attendee can raise this alert.' USING ERRCODE = '42501';
  END IF;

  SELECT e.id, e.title, e.start_date, e.end_date, e.event_date, e.status,
         e.geofencing_enabled, e.latitude, e.longitude,
         e.geofence_radius_meters,
         v.latitude AS venue_latitude,
         v.longitude AS venue_longitude,
         v.geofence_radius_meters AS venue_radius
  INTO v_event
  FROM public.events e
  LEFT JOIN public.venues v ON v.id = e.venue_id
  WHERE e.id = v_rsvp.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found.' USING ERRCODE = 'P0002';
  END IF;

  v_lat := COALESCE(v_event.venue_latitude, v_event.latitude);
  v_lng := COALESCE(v_event.venue_longitude, v_event.longitude);
  v_radius := COALESCE(v_event.venue_radius, v_event.geofence_radius_meters);

  IF COALESCE(v_event.geofencing_enabled, false) IS NOT TRUE
     OR v_lat IS NULL
     OR v_lng IS NULL
     OR v_radius IS NULL THEN
    RAISE EXCEPTION 'Campus Safety geofencing is not enabled for this event.' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_event.status, '') IN ('cancelled', 'canceled', 'archived') THEN
    RAISE EXCEPTION 'Cancelled events cannot raise safety alerts.' USING ERRCODE = '22023';
  END IF;

  IF NOW() < COALESCE(v_event.start_date, v_event.event_date)
     OR NOW() > COALESCE(v_event.end_date, v_event.start_date + INTERVAL '24 hours', v_event.event_date + INTERVAL '24 hours') THEN
    RAISE EXCEPTION 'Safety alerts can only be raised while the event is active.' USING ERRCODE = '22023';
  END IF;

  -- The client sends distance only; raw latitude/longitude never enters the database.
  IF p_distance_meters <= v_radius THEN
    RAISE EXCEPTION 'The supplied position is not outside the configured geofence.' USING ERRCODE = '22023';
  END IF;

  -- Reconnects and duplicate timers must not create an alert storm for one attendee.
  SELECT *
  INTO v_existing
  FROM public.event_geofence_alerts a
  WHERE a.rsvp_id = v_rsvp.id
    AND a.created_at > NOW() - INTERVAL '10 minutes'
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.event_geofence_alerts (
    event_id,
    rsvp_id,
    attendee_id,
    attendee_name,
    status,
    breached_at,
    escalated_at,
    distance_meters,
    accuracy_meters
  )
  SELECT
    v_event.id,
    v_rsvp.id,
    v_rsvp.user_id,
    COALESCE(NULLIF(BTRIM(p.full_name), ''), 'Attendee'),
    'escalated',
    NOW(),
    NOW(),
    ROUND(p_distance_meters::numeric, 1),
    CASE WHEN p_accuracy_meters IS NULL THEN NULL ELSE ROUND(p_accuracy_meters::numeric, 1) END
  FROM public.profiles p
  WHERE p.id = v_rsvp.user_id
  RETURNING * INTO v_alert;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendee profile not found.' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_alert;
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_event_geofence_alert(
  p_alert_id UUID
)
RETURNS public.event_geofence_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert public.event_geofence_alerts;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to acknowledge a safety alert.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.event_geofence_alerts
  SET status = 'acknowledged',
      responded_at = COALESCE(responded_at, NOW())
  WHERE id = p_alert_id
    AND attendee_id = auth.uid()
  RETURNING * INTO v_alert;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Safety alert not found for this attendee.' USING ERRCODE = '42501';
  END IF;

  RETURN v_alert;
END;
$$;

GRANT EXECUTE ON FUNCTION public.raise_event_geofence_alert(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_event_geofence_alert(UUID) TO authenticated;

COMMENT ON TABLE public.event_geofence_alerts IS
  'Minimal realtime safety escalation metadata. Raw attendee coordinates remain client-side and are never stored.';
COMMENT ON COLUMN public.event_geofence_alerts.distance_meters IS
  'Client-computed distance at escalation time; informational only and never used for authorization.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'event_geofence_alerts'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_geofence_alerts;
  END IF;
END;
$$;
