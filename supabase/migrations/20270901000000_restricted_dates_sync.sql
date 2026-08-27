-- Migration: 20270901000000_restricted_dates_sync.sql
-- Description: Automated Academic Calendar Synchronization (#3890).
-- Builds a dedicated `restricted_dates` table for Midterms/Finals/Reading
-- Days, populated by the existing sync-academic-calendar Edge Function
-- (ICS parser from #3229), plus a lookup RPC used at event-draft time.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'restricted_date_category') THEN
    CREATE TYPE restricted_date_category AS ENUM ('MIDTERMS', 'FINALS', 'READING_DAYS');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.restricted_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_uid TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category restricted_date_category NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  source_url TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT restricted_dates_valid_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_restricted_dates_range
  ON public.restricted_dates (start_date, end_date);

ALTER TABLE public.restricted_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restricted dates are viewable by everyone."
  ON public.restricted_dates;
CREATE POLICY "Restricted dates are viewable by everyone."
  ON public.restricted_dates FOR SELECT USING (true);

COMMENT ON TABLE public.restricted_dates IS
  'Midterms/Finals/Reading Days synced weekly from the University Registrar ICS feed (#3890).';

-- Lookup used by the event draft form: does a proposed window intersect a
-- restricted date?
CREATE OR REPLACE FUNCTION public.get_restricted_date_conflict(
    p_starts_at TIMESTAMPTZ,
    p_ends_at TIMESTAMPTZ
)
RETURNS TABLE (
    category restricted_date_category,
    title TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT r.category, r.title, r.start_date, r.end_date
    FROM public.restricted_dates r
    WHERE r.start_date <= p_ends_at
      AND r.end_date >= p_starts_at
    ORDER BY
        CASE r.category WHEN 'FINALS' THEN 0 WHEN 'MIDTERMS' THEN 1 ELSE 2 END,
        r.start_date
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_restricted_date_conflict(TIMESTAMPTZ, TIMESTAMPTZ)
  TO anon, authenticated, service_role;

-- Weekly sync, separate from the existing daily campus_calendar_events sync.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.schedule(
      'sync-restricted-dates-weekly',
      '0 4 * * 1',
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
  RAISE NOTICE 'Restricted dates cron was not scheduled: %', SQLERRM;
END $$;