-- ============================================================
-- Migration: 20270121000000_multi_campus_timezone_converter.sql
-- Issue: #3680 — Dynamic "Multi-Campus" Timezone Converter
--
-- Goals
--   1. Strict UTC storage for all event timestamps (already enforced by
--      migration 20260731240000_standardize_timestamps_utc.sql; this
--      migration asserts it for start_date / end_date / event_date).
--   2. Persist the venue's physical IANA timezone next to every event so
--      the frontend can render a dual-clock UI ("Your Local Time" vs
--      "Venue Local Time") without re-resolving GPS → tz on every render.
--   3. Provide an RPC the frontend / edge function can call once to get
--      {user_tz, venue_tz, start_utc, end_utc, show_dual_clock} for any
--      event, so the heavy work stays server-side.
--   4. Ship a tiny `campus_timezone_lookup` seed table covering the
--      campuses named in the issue (London, New York) plus a few major
--      global hubs. Real production should backfill this from
--      `venues.latitude`/`venues.longitude` once admin-set; the lookup
--      table is a fallback for events that only carry raw GPS coords.
-- ============================================================

BEGIN;

-- ─── 0. Assert UTC storage on the events table ────────────────────────
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'events'
          AND column_name IN ('start_date', 'end_date', 'event_date', 'start_time', 'end_time')
          AND data_type    = 'timestamp without time zone'
    ) THEN
        ALTER TABLE public.events
            ALTER COLUMN start_date  TYPE timestamptz USING start_date  AT TIME ZONE 'UTC',
            ALTER COLUMN end_date    TYPE timestamptz USING end_date    AT TIME ZONE 'UTC',
            ALTER COLUMN event_date  TYPE timestamptz USING event_date  AT TIME ZONE 'UTC';
    END IF;
END $$;

-- ─── 1. Add `timezone` column to venues & event_venues ───────────────
ALTER TABLE public.venues
    ADD COLUMN IF NOT EXISTS timezone TEXT;

ALTER TABLE public.event_venues
    ADD COLUMN IF NOT EXISTS timezone TEXT;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'venues_timezone_valid'
    ) THEN
        ALTER TABLE public.venues
            ADD CONSTRAINT venues_timezone_valid CHECK (
                timezone IS NULL OR EXISTS (
                    SELECT 1 FROM pg_timezone_names WHERE name = venues.timezone
                )
            );
    END IF;
END $$;

-- Backfill `venues.timezone` from the GPS coords via the campus lookup
-- table (created in step 2). Best-effort: if no campus matches, the
-- column stays NULL and the frontend falls back to UTC.
UPDATE public.venues v
SET timezone = ctl.timezone
FROM public.campus_timezone_lookup ctl
WHERE v.timezone IS NULL
  AND v.latitude  IS NOT NULL
  AND v.longitude IS NOT NULL
  AND ctl.latitude  IS NOT NULL
  AND ctl.longitude IS NOT NULL
  AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(v.longitude,  v.latitude ), 4326)::geography,
        ST_SetSRID(ST_MakePoint(ctl.longitude, ctl.latitude), 4326)::geography,
        50000  -- 50 km tolerance
      );

-- ─── 2. Seed a tiny lookup table of well-known campus timezones ──────
CREATE TABLE IF NOT EXISTS public.campus_timezone_lookup (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campus_name  TEXT NOT NULL,
    city         TEXT NOT NULL,
    country      TEXT NOT NULL,
    latitude     DOUBLE PRECISION NOT NULL,
    longitude    DOUBLE PRECISION NOT NULL,
    timezone     TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT campus_timezone_lookup_tz_valid CHECK (
        EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = timezone)
    ),
    CONSTRAINT campus_timezone_lookup_unique UNIQUE (campus_name, city)
);

ALTER TABLE public.campus_timezone_lookup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Campus timezone lookup is public read"
    ON public.campus_timezone_lookup FOR SELECT
    USING (true);

INSERT INTO public.campus_timezone_lookup
    (campus_name, city, country, latitude, longitude, timezone)
VALUES
    ('London Campus',        'London',       'United Kingdom', 51.5074, -0.1278, 'Europe/London'),
    ('New York Campus',      'New York',     'United States',  40.7128, -74.0060, 'America/New_York'),
    ('San Francisco Campus', 'San Francisco','United States',  37.7749, -122.4194,'America/Los_Angeles'),
    ('Toronto Campus',       'Toronto',      'Canada',         43.6532, -79.3832, 'America/Toronto'),
    ('Singapore Campus',     'Singapore',    'Singapore',      1.3521, 103.8198, 'Asia/Singapore'),
    ('Sydney Campus',        'Sydney',       'Australia',     -33.8688, 151.2093, 'Australia/Sydney'),
    ('Tokyo Campus',         'Tokyo',        'Japan',          35.6762, 139.6503, 'Asia/Tokyo'),
    ('Mumbai Campus',        'Mumbai',       'India',          19.0760, 72.8777,  'Asia/Kolkata'),
    ('Berlin Campus',        'Berlin',       'Germany',        52.5200, 13.4050, 'Europe/Berlin'),
    ('Dubai Campus',         'Dubai',        'UAE',            25.2048, 55.2708,  'Asia/Dubai')
ON CONFLICT (campus_name, city) DO UPDATE
SET timezone = EXCLUDED.timezone;

-- ─── 3. Add `venue_timezone` column to events (denormalized cache) ────
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS venue_timezone TEXT;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'events_venue_timezone_valid'
    ) THEN
        ALTER TABLE public.events
            ADD CONSTRAINT events_venue_timezone_valid CHECK (
                venue_timezone IS NULL OR EXISTS (
                    SELECT 1 FROM pg_timezone_names WHERE name = events.venue_timezone
                )
            );
    END IF;
END $$;

-- ─── 4. infer_timezone_from_coords(lat, lng) ─────────────────────────
CREATE OR REPLACE FUNCTION public.infer_timezone_from_coords(
    p_latitude  DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION DEFAULT 50000
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    inferred_tz TEXT;
    input_geo GEOGRAPHY;
BEGIN
    IF p_latitude IS NULL OR p_longitude IS NULL THEN
        RETURN NULL;
    END IF;

    input_geo := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;

    SELECT ctl.timezone
      INTO inferred_tz
      FROM public.campus_timezone_lookup ctl
      WHERE ST_DWithin(
              ST_SetSRID(ST_MakePoint(ctl.longitude, ctl.latitude), 4326)::geography,
              input_geo,
              radius_meters
            )
      ORDER BY ST_Distance(
                ST_SetSRID(ST_MakePoint(ctl.longitude, ctl.latitude), 4326)::geography,
                input_geo
              ) ASC
      LIMIT 1;

    RETURN inferred_tz;
END;
 $$;

GRANT EXECUTE ON FUNCTION public.infer_timezone_from_coords(
    DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION
) TO authenticated, anon;

-- ─── 5. Trigger to keep events.venue_timezone in sync ─────────────────
CREATE OR REPLACE FUNCTION public.sync_events_venue_timezone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    resolved_tz TEXT;
BEGIN
    IF NEW.venue_id IS NOT NULL THEN
        SELECT v.timezone INTO resolved_tz
          FROM public.venues v
         WHERE v.id = NEW.venue_id;
    END IF;

    IF resolved_tz IS NULL AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        resolved_tz := public.infer_timezone_from_coords(NEW.latitude, NEW.longitude);
    END IF;

    NEW.venue_timezone := COALESCE(resolved_tz, 'UTC');
    RETURN NEW;
END;
 $$;

DROP TRIGGER IF EXISTS trg_sync_events_venue_timezone ON public.events;
CREATE TRIGGER trg_sync_events_venue_timezone
BEFORE INSERT OR UPDATE OF venue_id, latitude, longitude ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.sync_events_venue_timezone();

-- Helper used by the backfill UPDATE below.
CREATE OR REPLACE FUNCTION public.sync_events_venue_timezone_resolved(
    p_venue_id  UUID,
    p_latitude  DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    resolved_tz TEXT;
BEGIN
    IF p_venue_id IS NOT NULL THEN
        SELECT v.timezone INTO resolved_tz FROM public.venues v WHERE v.id = p_venue_id;
    END IF;

    IF resolved_tz IS NULL AND p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN
        resolved_tz := public.infer_timezone_from_coords(p_latitude, p_longitude);
    END IF;

    RETURN COALESCE(resolved_tz, 'UTC');
END;
 $$;

GRANT EXECUTE ON FUNCTION public.sync_events_venue_timezone_resolved(
    UUID, DOUBLE PRECISION, DOUBLE PRECISION
) TO authenticated, anon;

-- Backfill existing rows.
UPDATE public.events
SET venue_timezone = public.sync_events_venue_timezone_resolved(
                        COALESCE(venue_id, NULL), latitude, longitude
                    )
WHERE venue_timezone IS NULL;

-- ─── 6. get_event_display_timezones(event_id) RPC ────────────────────
CREATE OR REPLACE FUNCTION public.get_event_display_timezones(p_event_id UUID)
RETURNS TABLE (
    event_id          UUID,
    start_utc         TIMESTAMPTZ,
    end_utc           TIMESTAMPTZ,
    venue_timezone    TEXT,
    venue_label       TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.start_date,
        e.end_date,
        COALESCE(e.venue_timezone, 'UTC') AS venue_timezone,
        COALESCE(
            NULLIF(e.location, ''),
            v.name,
            'Venue TBA'
        ) AS venue_label
    FROM public.events e
    LEFT JOIN public.venues v ON v.id = e.venue_id
    WHERE e.id = p_event_id
      AND e.deleted_at IS NULL
    LIMIT 1;
END;
 $$;

GRANT EXECUTE ON FUNCTION public.get_event_display_timezones(UUID)
    TO authenticated, anon;

-- ─── 7. Indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_venue_timezone ON public.events (venue_timezone);
CREATE INDEX IF NOT EXISTS idx_venues_timezone       ON public.venues (timezone);

COMMIT;
