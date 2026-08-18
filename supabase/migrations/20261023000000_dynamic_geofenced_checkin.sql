-- Migration: 20261023000000_dynamic_geofenced_checkin.sql
-- Description: Add latitude, longitude, and geofence_radius_meters to venues table, and update check_in_via_geofence RPC (#3271).

-- 1. Extend venues table
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER NOT NULL DEFAULT 100 CHECK (geofence_radius_meters > 0 AND geofence_radius_meters <= 5000);

-- Index for venue coordinate lookup
CREATE INDEX IF NOT EXISTS idx_venues_coords
  ON public.venues(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 2. Redefine check_in_via_geofence RPC function
CREATE OR REPLACE FUNCTION public.check_in_via_geofence(
  p_rsvp_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_accuracy_meters DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rsvp RECORD;
  v_event RECORD;
  v_distance DOUBLE PRECISION;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_radius INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to check in.';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude < -90 OR p_latitude > 90
     OR p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'A valid device location is required to check in.';
  END IF;

  SELECT id, event_id, user_id, checked_in, status
  INTO v_rsvp
  FROM public.event_rsvps
  WHERE id = p_rsvp_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RSVP not found.';
  END IF;

  IF v_rsvp.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only check yourself in.';
  END IF;

  IF v_rsvp.status IN ('rejected') THEN
    RAISE EXCEPTION 'Your RSVP for this event was not approved.';
  END IF;

  IF v_rsvp.status IN ('waitlisted', 'waitlist') THEN
    RAISE EXCEPTION 'You are on the waitlist and cannot check in yet.';
  END IF;

  SELECT e.id, e.latitude, e.longitude, e.geofencing_enabled, e.geofence_radius_meters,
         v.latitude AS venue_latitude, v.longitude AS venue_longitude, v.geofence_radius_meters AS venue_radius
  INTO v_event
  FROM public.events e
  LEFT JOIN public.venues v ON e.venue_id = v.id
  WHERE e.id = v_rsvp.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found.';
  END IF;

  IF v_rsvp.checked_in THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_checked_in', true
    );
  END IF;

  -- Resolve coordinates & radius: priority to venue, fallback to event
  v_lat := COALESCE(v_event.venue_latitude, v_event.latitude);
  v_lng := COALESCE(v_event.venue_longitude, v_event.longitude);
  v_radius := COALESCE(v_event.venue_radius, v_event.geofence_radius_meters);

  IF v_event.geofencing_enabled IS NOT TRUE
     OR v_lat IS NULL
     OR v_lng IS NULL THEN
    RAISE EXCEPTION 'Geofenced check-in is not enabled for this event. Please check in at the venue with an organizer.'
      USING ERRCODE = 'P0001', HINT = 'geofencing_disabled';
  END IF;

  v_distance := public.haversine_distance_meters(
    p_latitude, p_longitude, v_lat, v_lng
  );

  IF v_distance > v_radius THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'too_far',
      'distance_meters', ROUND(v_distance::numeric, 1),
      'radius_meters', v_radius
    );
  END IF;

  -- Set checkin bypass settings
  PERFORM set_config('app.geofence_checkin_bypass', v_rsvp.id::text, true);

  UPDATE public.event_rsvps
  SET checked_in = true
  WHERE id = v_rsvp.id;

  INSERT INTO public.event_attendance_logs (
    rsvp_id, recorded_by, verification_method, distance_meters, location_accuracy_meters
  ) VALUES (
    v_rsvp.id, auth.uid(), 'geofence', v_distance, p_accuracy_meters
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_checked_in', false,
    'distance_meters', ROUND(v_distance::numeric, 1),
    'radius_meters', v_radius
  );
END;
$$;
