-- ============================================================
-- Migration: Automated Event Cancellation Weather Triggers
-- Issue: #4224
-- ============================================================

-- ------------------------------------------------------------
-- 1. Ensure is_outdoors exists on venues table (with compatibility alias)
-- ------------------------------------------------------------

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS is_outdoors BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_outdoor BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Synchronize is_outdoors and is_outdoor if one is set
UPDATE public.venues
SET is_outdoors = is_outdoor
WHERE is_outdoor = TRUE AND is_outdoors = FALSE;

UPDATE public.venues
SET is_outdoor = is_outdoors
WHERE is_outdoors = TRUE AND is_outdoor = FALSE;

CREATE INDEX IF NOT EXISTS idx_venues_outdoors ON public.venues (is_outdoors) WHERE is_outdoors = TRUE;

-- ------------------------------------------------------------
-- 2. Enhanced Event Weather Alerts table
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_weather_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  forecast_time TIMESTAMPTZ NOT NULL,
  condition TEXT NOT NULL,
  precipitation_probability NUMERIC(5, 4) NOT NULL DEFAULT 0,
  temperature_c NUMERIC(5, 2),
  indoor_backup_url TEXT NOT NULL,
  alert_level TEXT NOT NULL DEFAULT 'severe',
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, forecast_time, condition)
);

CREATE INDEX IF NOT EXISTS idx_event_weather_alerts_event_created
  ON public.event_weather_alerts (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_weather_alerts_organizer
  ON public.event_weather_alerts (organizer_id, created_at DESC);

ALTER TABLE public.event_weather_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organizers can view their weather alerts" ON public.event_weather_alerts;
CREATE POLICY "Organizers can view their weather alerts"
  ON public.event_weather_alerts FOR SELECT TO authenticated
  USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Organizers can update their weather alerts" ON public.event_weather_alerts;
CREATE POLICY "Organizers can update their weather alerts"
  ON public.event_weather_alerts FOR UPDATE TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

GRANT SELECT, UPDATE ON public.event_weather_alerts TO authenticated;
GRANT ALL ON public.event_weather_alerts TO service_role;

-- ------------------------------------------------------------
-- 3. Schedule Hourly Cron Job for Weather Triggers
-- ------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hourly-outdoor-event-weather-monitor') THEN
    PERFORM cron.unschedule('hourly-outdoor-event-weather-monitor');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not inspect existing hourly weather monitor cron job: %', SQLERRM;
END $$;

SELECT cron.schedule(
  'hourly-outdoor-event-weather-monitor',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := COALESCE(current_setting('app.supabase_url', true), 'http://localhost:54321') || '/functions/v1/weather-monitor',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('source', 'hourly-cron')
    );
  $$
);
