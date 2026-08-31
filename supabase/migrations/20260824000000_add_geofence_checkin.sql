-- ============================================================
-- Migration: 20260824000000_add_geofence_checkin.sql
-- Feature: Geofenced Event Check-ins
-- Description:
--   1. Adds per-event geofencing config (radius + on/off toggle).
--      Coordinates already exist on `events` (latitude/longitude).
--   2. Adds verification metadata to `event_attendance_logs` so we
--      can tell a self geofence check-in apart from a QR scan or an
--      organizer's manual override.
--   3. Adds an IMMUTABLE haversine_distance_meters() helper.
--   4. Adds a SECURITY DEFINER RPC, check_in_via_geofence(), which
--      is the ONLY path a normal attendee can use to flip their own
--      `checked_in` flag to TRUE. It re-verifies the haversine
--      distance server-side (never trusts the client's pass/fail),
--      and is the single narrow exception carved into the
--      "organizers only" trigger installed in
--      20260716000011_secure_rsvp_rls.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Event geofencing configuration
-- ------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS geofencing_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER NOT NULL DEFAULT 100;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_geofence_radius_valid;

ALTER TABLE public.events
  ADD CONSTRAINT events_geofence_radius_valid
  CHECK (geofence_radius_meters > 0 AND geofence_radius_meters <= 5000);

COMMENT ON COLUMN public.events.geofencing_enabled IS
  'When TRUE, attendee self check-in requires the browser Geolocation API '
  'to report a position within geofence_radius_meters of (latitude, longitude). '
  'Organizers can disable this per-event (e.g. indoor venues with poor GPS) '
  'and fall back to QR/manual check-in.';

COMMENT ON COLUMN public.events.geofence_radius_meters IS
  'Radius, in meters, of the check-in geofence centered on (latitude, longitude).';

-- ------------------------------------------------------------
-- 2. Attendance log verification metadata
-- ------------------------------------------------------------

ALTER TABLE public.event_attendance_logs
  ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.event_attendance_logs
  DROP CONSTRAINT IF EXISTS check_attendance_logs_verification_method;

ALTER TABLE public.event_attendance_logs
  ADD CONSTRAINT check_attendance_logs_verification_method
  CHECK (verification_method IN ('manual', 'qr_scan', 'geofence', 'organizer_override'));

ALTER TABLE public.event_attendance_logs
  ADD COLUMN IF NOT EXISTS distance_meters DOUBLE PRECISION;

ALTER TABLE public.event_attendance_logs
  ADD COLUMN IF NOT EXISTS location_accuracy_meters DOUBLE PRECISION;

COMMENT ON COLUMN public.event_attendance_logs.verification_method IS
  'How this check-in was verified: manual (admin table edit), qr_scan (kiosk), '
  'geofence (attendee self check-in verified via check_in_via_geofence RPC), '
  'or organizer_override (admin manually checked someone in, e.g. GPS failure indoors).';

COMMENT ON COLUMN public.event_attendance_logs.distance_meters IS
  'Server-computed haversine distance, in meters, between the attendee''s '
  'reported position and the event''s (latitude, longitude) at check-in time. '
  'NULL when verification_method is not geofence.';

COMMENT ON COLUMN public.event_attendance_logs.location_accuracy_meters IS
  'The accuracy (meters) reported by navigator.geolocation.getCurrentPosition '
  'at the time of a geofence check-in. NULL when not applicable.';

-- ------------------------------------------------------------
-- 3. Haversine distance helper
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.haversine_distance_meters(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT 2 * 6371000 * ASIN(
    SQRT(
      POWER(SIN(RADIANS(lat2 - lat1) / 2), 2) +
      COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
      POWER(SIN(RADIANS(lng2 - lng1) / 2), 2)
    )
  );
$$;

COMMENT ON FUNCTION public.haversine_distance_meters IS
  'Great-circle distance in meters between two lat/lng points, using the '
  'haversine formula and Earth radius = 6,371,000 m.';

GRANT EXECUTE ON FUNCTION public.haversine_distance_meters(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION
) TO authenticated, anon;

-- ------------------------------------------------------------
-- 4. Extend the "organizers only" checked_in trigger with a
--    narrow, session-local bypass that only check_in_via_geofence()
--    below is able to set. Everyone else (including a compromised
--    client trying `UPDATE event_rsvps SET checked_in = true`
--    directly) is still blocked exactly as before.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_rsvp_checkin_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.checked_in IS DISTINCT FROM NEW.checked_in THEN

    -- Narrow bypass: only set (and immediately consumed) by
    -- check_in_via_geofence() for the exact row it just verified.
    IF current_setting('app.geofence_checkin_bypass', true) = NEW.id::text THEN
      RETURN NEW;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM club_members
      WHERE club_id = (
        SELECT club_id
        FROM events
        WHERE id = OLD.event_id
      )
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM clubs
      WHERE id = (
        SELECT club_id
        FROM events
        WHERE id = OLD.event_id
      )
      AND created_by = auth.uid()
    )
    THEN
      RAISE EXCEPTION 'Only event organizers can update checked_in';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Trigger definition is unchanged; we only replaced the function body above.

-- ------------------------------------------------------------
-- 5. check_in_via_geofence(): the only way a student can check
--    themselves in. Always re-verifies distance server-side —
--    the client-side distance check (done for instant UX feedback)
--    is never trusted.
-- ------------------------------------------------------------

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
    -- Self check-in only; organizers use the existing manual check-in flow.
    RAISE EXCEPTION 'You can only check yourself in.';
  END IF;

  IF v_rsvp.status IN ('rejected') THEN
    RAISE EXCEPTION 'Your RSVP for this event was not approved.';
  END IF;

  IF v_rsvp.status IN ('waitlisted', 'waitlist') THEN
    RAISE EXCEPTION 'You are on the waitlist and cannot check in yet.';
  END IF;

  SELECT id, latitude, longitude, geofencing_enabled, geofence_radius_meters,
         start_date, end_date
  INTO v_event
  FROM public.events
  WHERE id = v_rsvp.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found.';
  END IF;

  IF v_rsvp.checked_in THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_checked_in', true
    );
  END IF;

  -- Geofencing may be disabled for this event (e.g. indoor venue with
  -- unreliable GPS) — organizer opted for QR/manual check-in instead.
  IF v_event.geofencing_enabled IS NOT TRUE
     OR v_event.latitude IS NULL
     OR v_event.longitude IS NULL THEN
    RAISE EXCEPTION 'Geofenced check-in is not enabled for this event. Please check in at the venue with an organizer.'
      USING ERRCODE = 'P0001', HINT = 'geofencing_disabled';
  END IF;

  v_distance := public.haversine_distance_meters(
    p_latitude, p_longitude, v_event.latitude, v_event.longitude
  );

  IF v_distance > v_event.geofence_radius_meters THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'too_far',
      'distance_meters', ROUND(v_distance::numeric, 1),
      'radius_meters', v_event.geofence_radius_meters
    );
  END IF;

  -- Authorize exactly this row's checked_in flip for the trigger above,
  -- then perform the update in the same transaction.
DECLARE
  v_transition JSONB;END;
$$;
v_transition := public.transition_event_attendance(
  v_rsvp.id,
  'checked_in',
  'Geofence check-in'
);

IF COALESCE((v_transition->>'success')::BOOLEAN, FALSE) IS NOT TRUE THEN
  RAISE EXCEPTION '%',
    COALESCE(
      v_transition->>'message',
      v_transition->>'code',
      'Attendance transition failed.'
    );
END IF;

-- The transition function is responsible for changing the
-- attendance state and creating the audit record.
-- Update the latest audit entry with geofence-specific metadata.
UPDATE public.event_attendance_logs
SET
  verification_method = 'geofence',
  distance_meters = v_distance,
  location_accuracy_meters = p_accuracy_meters
WHERE rsvp_id = v_rsvp.id
  AND recorded_by = auth.uid()
  AND verification_method = 'manual'
  AND checked_in_at = (
    SELECT MAX(checked_in_at)
    FROM public.event_attendance_logs
    WHERE rsvp_id = v_rsvp.id
  );

RETURN jsonb_build_object(
  'success', true,
  'already_checked_in',
    COALESCE(
      (v_transition->>'code') = 'ALREADY_CHECKED_IN',
      false
    ),
  'distance_meters', ROUND(v_distance::numeric, 1),
  'radius_meters', v_event.geofence_radius_meters,
  'state', 'checked_in'
);
COMMENT ON FUNCTION public.check_in_via_geofence IS
  'Attendee self check-in. Verifies the caller owns the RSVP and that their '
  'reported device location is within the event''s geofence, then flips '
  'checked_in = true. Returns {success:false, reason:"too_far", ...} '
  '(not an exception) when the attendee is simply out of range, so the '
  'client can show a friendly "you are N meters away" message.';

GRANT EXECUTE ON FUNCTION public.check_in_via_geofence(
  UUID, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION
) TO authenticated;
