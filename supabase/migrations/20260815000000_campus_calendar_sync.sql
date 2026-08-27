-- Cross-campus academic calendar sync (#3229)
-- Calendar rows are maintained by the sync-academic-calendar Edge Function.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campus_calendar_event_type') THEN
    CREATE TYPE campus_calendar_event_type AS ENUM ('holiday', 'exam_period', 'admin');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.campus_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_uid TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  type campus_calendar_event_type NOT NULL DEFAULT 'admin',
  source_url TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT campus_calendar_events_valid_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_campus_calendar_events_date_range
  ON public.campus_calendar_events (start_date, end_date);

ALTER TABLE public.campus_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Academic calendar events are viewable by everyone."
  ON public.campus_calendar_events;
CREATE POLICY "Academic calendar events are viewable by everyone."
  ON public.campus_calendar_events FOR SELECT USING (true);

COMMENT ON TABLE public.campus_calendar_events IS
  'University academic calendar periods used for advisory event scheduling warnings.';
COMMENT ON COLUMN public.campus_calendar_events.source_uid IS
  'Stable UID from the upstream ICS feed, used for idempotent upserts.';

-- The service role used by the Edge Function is the only writer. When the
-- application settings are configured, refresh the feed every day at 03:00 UTC.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.schedule(
      'sync-campus-academic-calendar',
      '0 3 * * *',
      $cron$
        SELECT net.http_post(
          url := current_setting('app.settings.edge_function_base_url', true) || '/sync-academic-calendar',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
          ),
          body := '{}'::jsonb
        )
      $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Academic calendar cron was not scheduled: %', SQLERRM;
END $$;
