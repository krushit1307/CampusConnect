-- Issue #4283: Real-Time Event Capacity Thermal Map.
-- The provider adapter ingests aggregate device counts only. No device MAC
-- observations, probe identifiers, or attendee identity data are persisted.

CREATE TABLE IF NOT EXISTS public.event_wifi_access_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  mac_address TEXT NOT NULL,
  label TEXT NOT NULL,
  area_name TEXT NOT NULL,
  x_ft NUMERIC(8,2) NOT NULL CHECK (x_ft >= 0),
  y_ft NUMERIC(8,2) NOT NULL CHECK (y_ft >= 0),
  radius_ft NUMERIC(8,2) NOT NULL DEFAULT 12 CHECK (radius_ft > 0),
  max_device_capacity INTEGER NOT NULL CHECK (max_device_capacity > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_device_count INTEGER,
  last_sampled_at TIMESTAMPTZ,
  last_alerted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, mac_address),
  CHECK (mac_address = UPPER(mac_address))
);

CREATE TABLE IF NOT EXISTS public.event_wifi_density_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_point_id UUID NOT NULL REFERENCES public.event_wifi_access_points(id) ON DELETE CASCADE,
  device_count INTEGER NOT NULL CHECK (device_count >= 0),
  sampled_at TIMESTAMPTZ NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('meraki', 'aruba', 'normalized')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(access_point_id, sampled_at)
);

CREATE INDEX IF NOT EXISTS idx_event_wifi_access_points_event
  ON public.event_wifi_access_points(event_id, enabled);
CREATE INDEX IF NOT EXISTS idx_event_wifi_snapshots_ap_time
  ON public.event_wifi_density_snapshots(access_point_id, sampled_at DESC);

ALTER TABLE public.event_wifi_access_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_wifi_density_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.event_wifi_access_points FROM anon, authenticated;
REVOKE ALL ON public.event_wifi_density_snapshots FROM anon, authenticated;
GRANT ALL ON public.event_wifi_access_points TO service_role;
GRANT ALL ON public.event_wifi_density_snapshots TO service_role;

CREATE OR REPLACE FUNCTION public.is_event_organizer(p_event_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND (
        e.created_by = p_user_id
        OR public.is_club_admin(e.club_id, p_user_id)
        OR public.is_system_admin()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.upsert_event_wifi_access_point(
  p_event_id UUID,
  p_access_point_id UUID DEFAULT NULL,
  p_mac_address TEXT DEFAULT NULL,
  p_label TEXT DEFAULT NULL,
  p_area_name TEXT DEFAULT NULL,
  p_x_ft NUMERIC DEFAULT NULL,
  p_y_ft NUMERIC DEFAULT NULL,
  p_radius_ft NUMERIC DEFAULT 12,
  p_max_device_capacity INTEGER DEFAULT NULL,
  p_enabled BOOLEAN DEFAULT TRUE
)
RETURNS public.event_wifi_access_points
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_point public.event_wifi_access_points;
  v_mac TEXT := UPPER(BTRIM(COALESCE(p_mac_address, '')));
BEGIN
  IF NOT public.is_event_organizer(p_event_id) THEN
    RAISE EXCEPTION 'Only event organizers can manage Wi-Fi access points.' USING ERRCODE = '42501';
  END IF;
  IF v_mac !~ '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$' THEN
    RAISE EXCEPTION 'MAC address must use the form AA:BB:CC:DD:EE:FF.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(COALESCE(p_label, '')), '') IS NULL OR NULLIF(BTRIM(COALESCE(p_area_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Access point label and area name are required.' USING ERRCODE = '22023';
  END IF;
  IF p_x_ft IS NULL OR p_y_ft IS NULL OR p_x_ft < 0 OR p_y_ft < 0 THEN
    RAISE EXCEPTION 'Access point coordinates must be non-negative.' USING ERRCODE = '22023';
  END IF;
  IF p_max_device_capacity IS NULL OR p_max_device_capacity <= 0 THEN
    RAISE EXCEPTION 'A positive device capacity is required.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.event_wifi_access_points (
    id, event_id, mac_address, label, area_name, x_ft, y_ft, radius_ft,
    max_device_capacity, enabled, updated_at
  ) VALUES (
    COALESCE(p_access_point_id, gen_random_uuid()),
    p_event_id,
    v_mac,
    BTRIM(p_label),
    BTRIM(p_area_name),
    p_x_ft,
    p_y_ft,
    COALESCE(p_radius_ft, 12),
    p_max_device_capacity,
    COALESCE(p_enabled, TRUE),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    mac_address = EXCLUDED.mac_address,
    label = EXCLUDED.label,
    area_name = EXCLUDED.area_name,
    x_ft = EXCLUDED.x_ft,
    y_ft = EXCLUDED.y_ft,
    radius_ft = EXCLUDED.radius_ft,
    max_device_capacity = EXCLUDED.max_device_capacity,
    enabled = EXCLUDED.enabled,
    updated_at = NOW()
  RETURNING * INTO v_point;

  RETURN v_point;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_event_wifi_access_point(p_access_point_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT event_id INTO v_event_id FROM public.event_wifi_access_points WHERE id = p_access_point_id;
  IF v_event_id IS NULL OR NOT public.is_event_organizer(v_event_id) THEN
    RAISE EXCEPTION 'Only event organizers can remove Wi-Fi access points.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.event_wifi_access_points WHERE id = p_access_point_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_capacity_thermal_map(p_event_id UUID)
RETURNS TABLE (
  access_point_id UUID,
  mac_address TEXT,
  label TEXT,
  area_name TEXT,
  x_ft NUMERIC,
  y_ft NUMERIC,
  radius_ft NUMERIC,
  max_device_capacity INTEGER,
  device_count INTEGER,
  sampled_at TIMESTAMPTZ,
  over_capacity BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_event_organizer(p_event_id) THEN
    RAISE EXCEPTION 'Only event organizers can view Wi-Fi density.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT ap.id,
         ap.mac_address,
         ap.label,
         ap.area_name,
         ap.x_ft,
         ap.y_ft,
         ap.radius_ft,
         ap.max_device_capacity,
         ap.last_device_count,
         ap.last_sampled_at,
         COALESCE(ap.last_device_count, 0)::NUMERIC >= ap.max_device_capacity * 1.2
  FROM public.event_wifi_access_points ap
  WHERE ap.event_id = p_event_id AND ap.enabled = TRUE
  ORDER BY ap.area_name, ap.label;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_wifi_density_snapshot(
  p_access_point_id UUID,
  p_device_count INTEGER,
  p_sampled_at TIMESTAMPTZ,
  p_provider TEXT
)
RETURNS public.event_wifi_density_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot public.event_wifi_density_snapshots;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_device_count IS NULL OR p_device_count < 0 OR p_device_count > 1000000 THEN
    RAISE EXCEPTION 'Device count is outside the allowed range.' USING ERRCODE = '22023';
  END IF;
  IF p_provider NOT IN ('meraki', 'aruba', 'normalized') THEN
    RAISE EXCEPTION 'Unsupported Wi-Fi analytics provider.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.event_wifi_density_snapshots(access_point_id, device_count, sampled_at, provider)
  VALUES (p_access_point_id, p_device_count, COALESCE(p_sampled_at, NOW()), p_provider)
  ON CONFLICT (access_point_id, sampled_at) DO UPDATE SET device_count = EXCLUDED.device_count, provider = EXCLUDED.provider
  RETURNING * INTO v_snapshot;

  UPDATE public.event_wifi_access_points
  SET last_device_count = v_snapshot.device_count,
      last_sampled_at = v_snapshot.sampled_at,
      updated_at = NOW()
  WHERE id = p_access_point_id;

  RETURN v_snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_wifi_capacity_alerted(p_access_point_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.event_wifi_access_points
  SET last_alerted_at = NOW(), updated_at = NOW()
  WHERE id = p_access_point_id
    AND enabled = TRUE
    AND COALESCE(last_device_count, 0)::NUMERIC >= max_device_capacity * 1.2
    AND (last_alerted_at IS NULL OR last_alerted_at < NOW() - INTERVAL '15 minutes');
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_event_organizer(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_event_wifi_access_point(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_event_wifi_access_point(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_capacity_thermal_map(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_wifi_density_snapshot(UUID, INTEGER, TIMESTAMPTZ, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_wifi_capacity_alerted(UUID) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_wifi_access_points;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add event_wifi_access_points to Realtime publication: %', SQLERRM;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-event-wifi-density') THEN
      PERFORM cron.unschedule('sync-event-wifi-density');
    END IF;
    PERFORM cron.schedule(
      'sync-event-wifi-density',
      '* * * * *',
      $wifi_job$
        SELECT net.http_post(
          url := COALESCE(current_setting('app.supabase_url', true), 'http://127.0.0.1:54321') || '/functions/v1/sync-wifi-density',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE(current_setting('app.service_role_key', true), '')
          ),
          body := '{}'::jsonb
        );
      $wifi_job$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule Wi-Fi density sync: %', SQLERRM;
END;
$$;
