-- Issue #3598: Automated Bad Weather Event Rescheduling

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS is_outdoor BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_venues_outdoor ON public.venues (is_outdoor) WHERE is_outdoor = TRUE;

CREATE TABLE IF NOT EXISTS public.event_weather_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  forecast_time TIMESTAMPTZ NOT NULL,
  condition TEXT NOT NULL,
  precipitation_probability NUMERIC(5, 4) NOT NULL DEFAULT 0,
  temperature_c NUMERIC(5, 2),
  indoor_backup_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, forecast_time, condition)
);

CREATE INDEX IF NOT EXISTS idx_event_weather_alerts_event_created
  ON public.event_weather_alerts (event_id, created_at DESC);

ALTER TABLE public.event_weather_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organizers can view their weather alerts" ON public.event_weather_alerts;
CREATE POLICY "Organizers can view their weather alerts"
  ON public.event_weather_alerts FOR SELECT TO authenticated
  USING (organizer_id = auth.uid());

COMMENT ON TABLE public.event_weather_alerts IS
  'Deduplicated severe-weather alerts emitted by the daily outdoor-event monitor. Issue #3598.';

-- The Edge Function owns alert insertion; regular clients cannot forge alerts.
REVOKE ALL ON public.event_weather_alerts FROM authenticated;
GRANT SELECT ON public.event_weather_alerts TO authenticated;
GRANT ALL ON public.event_weather_alerts TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-outdoor-event-weather-monitor') THEN
    PERFORM cron.unschedule('daily-outdoor-event-weather-monitor');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not inspect existing weather monitor cron job: %', SQLERRM;
END $$;

SELECT cron.schedule(
  'daily-outdoor-event-weather-monitor',
  '0 6 * * *',
  $$
    SELECT net.http_post(
      url := COALESCE(current_setting('app.supabase_url', true), 'http://localhost:54321') || '/functions/v1/weather-monitor',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('source', 'daily-cron')
    );
  $$
);
