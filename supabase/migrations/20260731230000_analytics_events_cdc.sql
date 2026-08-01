-- ============================================================
-- Migration: Analytics events sink + Realtime CDC publication
-- Description: Implements logical replication for CDC (Change
--              Data Capture) without Kafka/Debezium.
--   - Creates the `analytics_events` sink table (PII-safe).
--   - Ensures the `supabase_realtime` publication streams
--     `events`, `event_rsvps` and `profiles` (the app's user
--     table; `users` maps to `public.profiles` in this schema).
--   - WAL level is already `logical` on Supabase managed and
--     local dev images, so no server config change is needed.
-- ============================================================

-- 1. Analytics sink table -------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- commit_timestamp from the replication slot guarantees events can be
  -- replayed in exact chronological order even if webhooks arrive out of order.
  commit_timestamp TIMESTAMPTZ NOT NULL,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id TEXT,
  -- PII-stripped payload of the row change.
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_record JSONB,
  old_record JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Dedupes duplicate webhook deliveries (at-least-once delivery).
  CONSTRAINT analytics_events_delivery_unique
    UNIQUE (commit_timestamp, table_name, operation, record_id)
);

-- Fast path for analytics queries such as "RSVPs yesterday".
CREATE INDEX IF NOT EXISTS idx_analytics_events_table_commit
  ON public.analytics_events (table_name, commit_timestamp);

-- 2. Security: sink is only reachable via service_role --------------
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.analytics_events FROM PUBLIC;
REVOKE ALL ON public.analytics_events FROM anon;
REVOKE ALL ON public.analytics_events FROM authenticated;
GRANT ALL ON public.analytics_events TO service_role;

-- 3. Logical replication publication ----------------------------------
-- `supabase_realtime` already exists on hosted Supabase; create it for
-- local dev if missing, then add the tracked tables idempotently.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('public', 'events'),
      ('public', 'event_rsvps'),
      ('public', 'profiles')
    ) AS v(schemaname, tablename)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = t.schemaname
        AND tablename = t.tablename
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I', t.schemaname, t.tablename);
    END IF;
  END LOOP;
END $$;
