-- ============================================================
-- Migration: Meilisearch Dead-Letter Queue (Issue #2686)
--
-- Creates the meilisearch_dlq table that the meilisearch-sync
-- Edge Function writes to when a Meilisearch push fails. The
-- meilisearch-dlq-retry scheduled function retries these rows
-- with exponential backoff.
--
-- Also creates the Supabase Database Webhooks (via pg_net) that
-- invoke the meilisearch-sync Edge Function on INSERT/UPDATE/DELETE
-- for the events, clubs, and profiles tables.
-- ============================================================

-- ── Step 1: Create the DLQ table ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.meilisearch_dlq (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    payload JSONB NOT NULL,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    exhausted BOOLEAN NOT NULL DEFAULT FALSE,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the retry query: WHERE exhausted = false AND next_retry_at <= NOW()
CREATE INDEX IF NOT EXISTS idx_meilisearch_dlq_retry
    ON public.meilisearch_dlq (next_retry_at)
    WHERE exhausted = FALSE;

-- Index for manual inspection of exhausted rows.
CREATE INDEX IF NOT EXISTS idx_meilisearch_dlq_exhausted
    ON public.meilisearch_dlq (created_at DESC)
    WHERE exhausted = TRUE;

-- Enable RLS — only the service role (Edge Functions) can read/write.
ALTER TABLE public.meilisearch_dlq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage DLQ." ON public.meilisearch_dlq;
CREATE POLICY "Service role can manage DLQ."
ON public.meilisearch_dlq FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ── Step 2: Create Database Webhooks via pg_net ────────────────
-- Each trigger fires an HTTP POST to the meilisearch-sync Edge
-- Function with the row payload. The webhook URL is read from
-- app config (vault) so it's not hard-coded.
--
-- Note: In Supabase, Database Webhooks can also be configured via
-- the Dashboard → Database → Webhooks. This migration creates them
-- via SQL so they're version-controlled.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Generic webhook sender for INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.notify_meilisearch_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_webhook_url TEXT;
    v_payload JSONB;
BEGIN
    v_webhook_url := COALESCE(
        current_setting('app.meilisearch_sync_url', true),
        'http://localhost:54321/functions/v1/meilisearch-sync'
    );

    v_payload := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'schema', TG_TABLE_SCHEMA,
        'record', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        'old_record', CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END
    );

    -- Fire and forget — pg_net is asynchronous.
    PERFORM net.http_post(
        url := v_webhook_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE(
                current_setting('app.service_role_key', true),
                ''
            )
        ),
        body := v_payload
    );

    RETURN COALESCE(NEW, OLD);
END;
 $$;

-- Create triggers for events, clubs, profiles.
DROP TRIGGER IF EXISTS on_events_meilisearch_sync ON public.events;
CREATE TRIGGER on_events_meilisearch_sync
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.notify_meilisearch_sync();

DROP TRIGGER IF EXISTS on_clubs_meilisearch_sync ON public.clubs;
CREATE TRIGGER on_clubs_meilisearch_sync
AFTER INSERT OR UPDATE OR DELETE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.notify_meilisearch_sync();

DROP TRIGGER IF EXISTS on_profiles_meilisearch_sync ON public.profiles;
CREATE TRIGGER on_profiles_meilisearch_sync
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_meilisearch_sync();

-- ── Step 3: Schedule the DLQ retry function ────────────────────
-- Runs every 5 minutes via Supabase's pg_cron extension.
-- (pg_cron must be enabled in the Supabase project settings.)

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        -- pg_cron not installed — skip the schedule.
        -- The DLQ retry function can still be invoked manually.
        RAISE NOTICE 'pg_cron not installed; skipping DLQ retry schedule.';
        RETURN;
    END IF;

    -- Schedule the retry function.
    PERFORM cron.schedule(
        jobname := 'meilisearch-dlq-retry',
        schedule := '*/5 * * * *',
        command := $cmd$             SELECT net.http_post(
                url := current_setting('app.meilisearch_dlq_retry_url', true)
                    || '/functions/v1/meilisearch-dlq-retry',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
                ),
                body := '{}'::jsonb
            );
        $cmd$     );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule DLQ retry: %', SQLERRM;
END $$;

COMMENT ON TABLE public.meilisearch_dlq IS
'Dead-letter queue for failed Meilisearch syncs. The meilisearch-sync Edge Function writes here when a push fails; the meilisearch-dlq-retry scheduled function retries with exponential backoff (max 10 retries).';

COMMENT ON FUNCTION public.notify_meilisearch_sync() IS
'Generic AFTER INSERT/UPDATE/DELETE trigger that fires an HTTP POST to the meilisearch-sync Edge Function with the row payload. Used on events, clubs, and profiles tables.';

-- ============================================================
-- End of migration
-- ============================================================
