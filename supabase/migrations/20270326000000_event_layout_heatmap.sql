-- =============================================================================
-- Issue #4722 - Interactive "Event Layout" Heatmap Analyzer
-- Localized zone check-ins (Zone A / Zone B door kiosks), realtime occupancy
-- for the organizer heatmap, and a Campus Security corridor-restrict alert
-- when a zone reaches 95% capacity.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.event_layout_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  corridor_name TEXT NOT NULL,
  max_capacity INTEGER NOT NULL CHECK (max_capacity > 0),
  current_occupancy INTEGER NOT NULL DEFAULT 0 CHECK (current_occupancy >= 0),
  x_ft NUMERIC NOT NULL DEFAULT 0,
  y_ft NUMERIC NOT NULL DEFAULT 0,
  width_ft NUMERIC NOT NULL DEFAULT 50,
  height_ft NUMERIC NOT NULL DEFAULT 30,
  door_x_ft NUMERIC NOT NULL DEFAULT 0,
  door_y_ft NUMERIC NOT NULL DEFAULT 0,
  security_alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, name)
);

CREATE INDEX IF NOT EXISTS idx_event_layout_zones_event
  ON public.event_layout_zones (event_id);

CREATE TABLE IF NOT EXISTS public.event_zone_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES public.event_layout_zones(id) ON DELETE CASCADE,
  ticket_payload TEXT,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_zone_checkins_event_scanned
  ON public.event_zone_checkins (event_id, scanned_at DESC);

CREATE TABLE IF NOT EXISTS public.campus_security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES public.event_layout_zones(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_security_alerts_event
  ON public.campus_security_alerts (event_id, created_at DESC);

ALTER TABLE public.event_layout_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_zone_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_security_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view event layout zones" ON public.event_layout_zones;
CREATE POLICY "Anyone can view event layout zones"
  ON public.event_layout_zones FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can view event zone checkins" ON public.event_zone_checkins;
CREATE POLICY "Anyone can view event zone checkins"
  ON public.event_zone_checkins FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can view campus security alerts" ON public.campus_security_alerts;
CREATE POLICY "Authenticated can view campus security alerts"
  ON public.campus_security_alerts FOR SELECT TO authenticated
  USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_layout_zones;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_zone_checkins;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campus_security_alerts;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add layout heatmap tables to supabase_realtime: %', SQLERRM;
END $$;

-- Seed Zone A / Zone B on the floorplan if the event has none yet.
CREATE OR REPLACE FUNCTION public.ensure_event_layout_zones(
  p_event_id UUID,
  p_width_ft NUMERIC DEFAULT 100,
  p_height_ft NUMERIC DEFAULT 60
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_width NUMERIC := GREATEST(COALESCE(p_width_ft, 100), 10);
  v_height NUMERIC := GREATEST(COALESCE(p_height_ft, 60), 10);
  v_half NUMERIC := v_height / 2.0;
BEGIN
  IF p_event_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  INSERT INTO public.event_layout_zones (
    event_id, name, corridor_name, max_capacity,
    x_ft, y_ft, width_ft, height_ft, door_x_ft, door_y_ft
  )
  SELECT p_event_id, 'Zone A', 'Zone A corridor', 2500,
         0, 0, v_width, v_half, v_width / 2.0, v_half
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_layout_zones WHERE event_id = p_event_id
  );

  INSERT INTO public.event_layout_zones (
    event_id, name, corridor_name, max_capacity,
    x_ft, y_ft, width_ft, height_ft, door_x_ft, door_y_ft
  )
  SELECT p_event_id, 'Zone B', 'Zone B corridor', 2500,
         0, v_half, v_width, v_half, v_width / 2.0, v_half
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_layout_zones
    WHERE event_id = p_event_id AND name = 'Zone B'
  );

  RETURN COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(z) ORDER BY z.name)
      FROM public.event_layout_zones z
      WHERE z.event_id = p_event_id
    ),
    '[]'::jsonb
  );
END;
$$;

-- Localized QR check-in at a zone door. Fans occupancy over realtime and
-- dispatches Campus Security when the zone first crosses 95% capacity.
CREATE OR REPLACE FUNCTION public.record_event_zone_checkin(
  p_zone_id UUID,
  p_ticket_payload TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone public.event_layout_zones%ROWTYPE;
  v_new_occupancy INTEGER;
  v_ratio NUMERIC;
  v_crossed BOOLEAN := FALSE;
  v_message TEXT;
BEGIN
  SELECT * INTO v_zone
  FROM public.event_layout_zones
  WHERE id = p_zone_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Zone not found.');
  END IF;

  v_new_occupancy := v_zone.current_occupancy + 1;
  v_ratio := v_new_occupancy::NUMERIC / v_zone.max_capacity::NUMERIC;
  v_crossed := v_ratio >= 0.95 AND v_zone.security_alerted_at IS NULL;

  UPDATE public.event_layout_zones
  SET current_occupancy = v_new_occupancy,
      updated_at = NOW(),
      security_alerted_at = CASE WHEN v_crossed THEN NOW() ELSE security_alerted_at END
  WHERE id = p_zone_id;

  INSERT INTO public.event_zone_checkins (event_id, zone_id, ticket_payload)
  VALUES (v_zone.event_id, p_zone_id, p_ticket_payload);

  IF v_crossed THEN
    v_message := 'Restrict access to the ' || v_zone.corridor_name
      || '. ' || v_zone.name || ' has reached 95% capacity.';

    INSERT INTO public.campus_security_alerts (event_id, zone_id, message)
    VALUES (v_zone.event_id, p_zone_id, v_message);

    BEGIN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      SELECT p.id,
             'campus_security_alert',
             'Campus Security: Restrict Corridor',
             v_message,
             '/events/' || v_zone.event_id || '/dashboard'
      FROM public.profiles p
      WHERE COALESCE(p.is_admin, FALSE)
         OR p.role::TEXT IN ('admin', 'safety_admin', 'system_admin', 'campus_security');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'zone_id', p_zone_id,
    'zone_name', v_zone.name,
    'current_occupancy', v_new_occupancy,
    'max_capacity', v_zone.max_capacity,
    'security_alert', v_crossed,
    'message', CASE WHEN v_crossed THEN v_message ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_event_layout_zones(UUID, NUMERIC, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_event_zone_checkin(UUID, TEXT) TO authenticated;

COMMENT ON TABLE public.event_layout_zones IS
  'Floorplan zones (Zone A / Zone B) with occupancy used by the event layout heatmap.';
COMMENT ON FUNCTION public.record_event_zone_checkin(UUID, TEXT) IS
  'Records a localized QR check-in at a zone door and alerts Campus Security at 95% occupancy.';
