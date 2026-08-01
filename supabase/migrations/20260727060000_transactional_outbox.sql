-- Migration: 20260727060000_transactional_outbox.sql
-- Description: Implement Transactional Outbox Pattern for guaranteed async delivery of event/post side effects.

-- 1. Create outbox_events table
CREATE TABLE IF NOT EXISTS public.outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processed', 'failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);

-- Index on status and created_at to make queue polling O(1)
CREATE INDEX IF NOT EXISTS idx_outbox_events_status_created_at
ON public.outbox_events (status, created_at ASC)
WHERE status = 'pending';

-- Enable Row Level Security (RLS) on outbox log
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

-- Restrict read permissions to system administrators only
DROP POLICY IF EXISTS "Admins can view outbox events" ON public.outbox_events;
CREATE POLICY "Admins can view outbox events"
ON public.outbox_events
FOR SELECT
TO authenticated
USING (public.is_system_admin());


-- 2. Trigger function to automatically populate outbox
CREATE OR REPLACE FUNCTION public.enqueue_outbox_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.outbox_events (payload)
    VALUES (
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'action', TG_OP,
            'record', to_jsonb(NEW)
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Bind triggers on critical tables
DROP TRIGGER IF EXISTS trigger_events_outbox ON public.events;
CREATE TRIGGER trigger_events_outbox
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_outbox_event();

DROP TRIGGER IF EXISTS trigger_posts_outbox ON public.posts;
CREATE TRIGGER trigger_posts_outbox
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_outbox_event();


-- 4. Queue processing RPC function called by pg_cron
CREATE OR REPLACE FUNCTION public.process_outbox_events()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row RECORD;
    v_url TEXT := 'http://localhost:54321/functions/v1/process-outbox';
    v_has_net BOOLEAN;
BEGIN
    -- Check if pg_net is available
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'http_post' AND n.nspname = 'net'
    ) INTO v_has_net;

    -- Process pending outbox events sequentially, limiting batch size
    FOR v_row IN 
        SELECT id, payload 
        FROM public.outbox_events 
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT 10
    LOOP
        -- Mark status as processed immediately to prevent double execution
        UPDATE public.outbox_events
        SET status = 'processed',
            processed_at = NOW()
        WHERE id = v_row.id;

        -- Invoke external process-outbox edge function asynchronously
        IF v_has_net THEN
            PERFORM net.http_post(
                url := v_url,
                headers := '{"Content-Type": "application/json"}'::jsonb,
                body := jsonb_build_object('outbox_id', v_row.id, 'payload', v_row.payload)
            );
        ELSIF EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE p.proname = 'http_post' AND n.nspname = 'extensions'
        ) THEN
            PERFORM extensions.http_post(
                url := v_url,
                headers := '{"Content-Type": "application/json"}'::jsonb,
                body := jsonb_build_object('outbox_id', v_row.id, 'payload', v_row.payload)
            );
        END IF;
    END LOOP;
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.process_outbox_events() TO authenticated, service_role;


-- 5. Enable pg_cron and schedule background worker
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-outbox-worker') THEN
    PERFORM cron.unschedule('process-outbox-worker');
  END IF;
END
$$;

SELECT cron.schedule(
  'process-outbox-worker',
  '* * * * *',
  $$SELECT public.process_outbox_events();$$
);
