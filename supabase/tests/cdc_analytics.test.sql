-- ============================================================
-- Test Suite: cdc_analytics.test.sql
-- Description: Verifies the analytics_events sink table schema,
--              RLS lockdown, and the supabase_realtime publication
--              covering events / event_rsvps / profiles for CDC.
-- ============================================================

BEGIN;

-- Enable pgTAP extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Plan the tests
SELECT plan(14);

-- Test 1: Verify analytics_events table exists
SELECT has_table('public', 'analytics_events', 'Table public.analytics_events should exist');

-- Test 2: Verify required columns exist
SELECT columns_are(
  'public',
  'analytics_events',
  ARRAY[
    'id',
    'commit_timestamp',
    'table_name',
    'operation',
    'record_id',
    'payload',
    'new_record',
    'old_record',
    'received_at'
  ],
  'analytics_events should expose the expected CDC columns'
);

-- Test 3: commit_timestamp is NOT NULL and timestamptz
SELECT col_not_null('public', 'analytics_events', 'commit_timestamp', 'commit_timestamp is NOT NULL');
SELECT col_type_is('public', 'analytics_events', 'commit_timestamp', 'timestamp with time zone', 'commit_timestamp is timestamptz');

-- Test 4: operation is constrained to the allowed set
SELECT has_check(
  'public',
  'analytics_events',
  'operation',
  'operation column should enforce INSERT/UPDATE/DELETE'
);

-- Test 5: duplicate webhook deliveries are deduplicated
SELECT has_constraint(
  'public',
  'analytics_events',
  'analytics_events_delivery_unique',
  'analytics_events should have a delivery-uniqueness constraint'
);

-- Test 6: query index on (table_name, commit_timestamp) exists
SELECT has_index(
  'public',
  'analytics_events',
  'idx_analytics_events_table_commit',
  ARRAY['table_name', 'commit_timestamp'],
  'analytics_events should index (table_name, commit_timestamp) for analytics queries'
);

-- Test 7: RLS is enabled on the sink table
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.analytics_events'::regclass),
  true,
  'Row Level Security should be enabled on analytics_events'
);

-- Test 8: anon/authenticated roles have no privileges on the sink
SELECT is(
  (SELECT count(*) FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'analytics_events'
     AND grantee IN ('anon', 'authenticated')),
  0,
  'anon/authenticated should have zero privileges on analytics_events'
);

-- Test 9: supabase_realtime publication exists
SELECT ok(
  EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'),
  'publication supabase_realtime should exist'
);

-- Test 10-12: publication covers the tracked CDC tables
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'events'
  ),
  'supabase_realtime should publish public.events'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_rsvps'
  ),
  'supabase_realtime should publish public.event_rsvps'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ),
  'supabase_realtime should publish public.profiles'
);

-- Test 13: end-to-end sink insert + idempotent delivery dedupe
INSERT INTO public.analytics_events
  (commit_timestamp, table_name, operation, record_id, payload)
VALUES
  ('2026-07-31T10:00:00Z', 'public.event_rsvps', 'INSERT', 'rsvp-1',
   '{"event_id":"e1","user_id":"u1","email":"[REDACTED]"}'::jsonb);

-- Re-delivery of the same change (same commit, table, operation, record) is ignored.
INSERT INTO public.analytics_events
  (commit_timestamp, table_name, operation, record_id, payload)
VALUES
  ('2026-07-31T10:00:00Z', 'public.event_rsvps', 'INSERT', 'rsvp-1',
   '{"event_id":"e1","user_id":"u1","email":"[REDACTED]"}'::jsonb)
ON CONFLICT ON CONSTRAINT analytics_events_delivery_unique DO NOTHING;

SELECT is(
  (SELECT count(*) FROM public.analytics_events
   WHERE record_id = 'rsvp-1' AND operation = 'INSERT'),
  1,
  'Re-delivered CDC events should be deduplicated to a single sink row'
);

SELECT * FROM finish();
ROLLBACK;
