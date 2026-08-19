-- Issue #3440: Campus Wi-Fi Connectivity Overlay
-- Venue network metrics are maintained from recent, authenticated speed reports.

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS avg_wifi_speed_mbps NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS max_device_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS wifi_report_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_wifi_tested_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venues_max_device_capacity_positive'
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_max_device_capacity_positive
      CHECK (max_device_capacity IS NULL OR max_device_capacity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'venues_avg_wifi_speed_non_negative'
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_avg_wifi_speed_non_negative
      CHECK (avg_wifi_speed_mbps IS NULL OR avg_wifi_speed_mbps >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.venue_wifi_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  download_speed_mbps NUMERIC(10, 2) NOT NULL CHECK (download_speed_mbps >= 0 AND download_speed_mbps <= 100000),
  device_count_at_time INTEGER CHECK (device_count_at_time IS NULL OR (device_count_at_time >= 0 AND device_count_at_time <= 100000)),
  upload_speed_mbps NUMERIC(10, 2) CHECK (upload_speed_mbps IS NULL OR (upload_speed_mbps >= 0 AND upload_speed_mbps <= 100000)),
  latency_ms NUMERIC(10, 2) CHECK (latency_ms IS NULL OR (latency_ms >= 0 AND latency_ms <= 100000)),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venue_wifi_reports_recent
  ON public.venue_wifi_reports (venue_id, created_at DESC);

ALTER TABLE public.venue_wifi_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view Wi-Fi reports" ON public.venue_wifi_reports;
CREATE POLICY "Authenticated users can view Wi-Fi reports"
  ON public.venue_wifi_reports FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can submit their own Wi-Fi reports" ON public.venue_wifi_reports;
CREATE POLICY "Users can submit their own Wi-Fi reports"
  ON public.venue_wifi_reports FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());

CREATE OR REPLACE FUNCTION public.refresh_venue_wifi_avg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_speed NUMERIC(10, 2);
  v_report_count INTEGER;
BEGIN
  SELECT
    ROUND(AVG(download_speed_mbps), 2),
    COUNT(*)::INTEGER
  INTO v_avg_speed, v_report_count
  FROM public.venue_wifi_reports
  WHERE venue_id = NEW.venue_id
    AND created_at >= NOW() - INTERVAL '90 days';

  UPDATE public.venues
  SET avg_wifi_speed_mbps = v_avg_speed,
      wifi_report_count = v_report_count,
      last_wifi_tested_at = NOW(),
      updated_at = NOW()
  WHERE id = NEW.venue_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_venue_wifi_avg_after_insert ON public.venue_wifi_reports;
CREATE TRIGGER refresh_venue_wifi_avg_after_insert
AFTER INSERT ON public.venue_wifi_reports
FOR EACH ROW
EXECUTE FUNCTION public.refresh_venue_wifi_avg();

DROP FUNCTION IF EXISTS public.submit_venue_wifi_report(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION public.submit_venue_wifi_report(
  p_venue_id UUID,
  p_download_speed_mbps NUMERIC,
  p_device_count INTEGER DEFAULT NULL,
  p_upload_speed_mbps NUMERIC DEFAULT NULL,
  p_latency_ms NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_speed NUMERIC(10, 2);
  v_report_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to submit a Wi-Fi report.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = p_venue_id) THEN
    RAISE EXCEPTION 'Venue not found.' USING ERRCODE = 'P0002';
  END IF;

  IF p_download_speed_mbps IS NULL OR p_download_speed_mbps < 0 OR p_download_speed_mbps > 100000 THEN
    RAISE EXCEPTION 'Download speed must be between 0 and 100000 Mbps.' USING ERRCODE = '22023';
  END IF;

  IF p_device_count IS NOT NULL AND (p_device_count < 0 OR p_device_count > 100000) THEN
    RAISE EXCEPTION 'Device count must be between 0 and 100000.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.venue_wifi_reports (
    venue_id,
    reported_by,
    download_speed_mbps,
    device_count_at_time,
    upload_speed_mbps,
    latency_ms,
    notes
  )
  VALUES (
    p_venue_id,
    auth.uid(),
    ROUND(p_download_speed_mbps, 2),
    p_device_count,
    CASE WHEN p_upload_speed_mbps IS NULL THEN NULL ELSE ROUND(p_upload_speed_mbps, 2) END,
    CASE WHEN p_latency_ms IS NULL THEN NULL ELSE ROUND(p_latency_ms, 2) END,
    NULLIF(btrim(p_notes), '')
  );

  SELECT avg_wifi_speed_mbps, wifi_report_count
  INTO v_avg_speed, v_report_count
  FROM public.venues
  WHERE id = p_venue_id;

  RETURN jsonb_build_object(
    'venue_id', p_venue_id,
    'avg_wifi_speed_mbps', v_avg_speed,
    'wifi_report_count', v_report_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_venue_wifi_report(UUID, NUMERIC, INTEGER, NUMERIC, NUMERIC, TEXT) TO authenticated;

COMMENT ON COLUMN public.venues.avg_wifi_speed_mbps IS
  'Average download speed from authenticated reports over the last 90 days. Issue #3440.';
COMMENT ON COLUMN public.venues.max_device_capacity IS
  'Historical device capacity before connection quality degrades. Issue #3440.';
