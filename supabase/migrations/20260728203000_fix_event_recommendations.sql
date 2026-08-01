-- Migration: 20260728203000_fix_event_recommendations.sql
-- Description: Fix hardcoded localhost webhook configuration and ensure it runs on UPDATE

CREATE OR REPLACE FUNCTION public.handle_new_event_embedding()
RETURNS TRIGGER AS $$
DECLARE
    -- Use dynamic setting if available, fallback to localhost for local dev
    base_url TEXT := COALESCE(
        current_setting('app.settings.supabase_url', true),
        'http://localhost:54321'
    );
    function_url TEXT := base_url || '/functions/v1/generate-event-embeddings';
    payload JSONB;
BEGIN
    -- Support both INSERT and UPDATE based on TG_OP
    payload := jsonb_build_object(
        'type', TG_OP,
        'table', 'events',
        'record', jsonb_build_object(
            'id', NEW.id,
            'title', COALESCE(NEW.title, ''),
            'description', COALESCE(NEW.description, '')
        )
    );

    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'http_post' AND n.nspname = 'net'
    ) THEN
        PERFORM net.http_post(
            url := function_url,
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := payload
        );
    ELSIF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'http_post' AND n.nspname = 'extensions'
    ) THEN
        PERFORM extensions.http_post(
            url := function_url,
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := payload
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger to fire on INSERT OR UPDATE OF title, description
DROP TRIGGER IF EXISTS on_event_created_embedding ON public.events;
CREATE TRIGGER on_event_created_embedding
AFTER INSERT OR UPDATE OF title, description ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_event_embedding();

-- Backfill events missing embeddings
DO $$
DECLARE
    r RECORD;
    base_url TEXT := COALESCE(
        current_setting('app.settings.supabase_url', true),
        'http://localhost:54321'
    );
    function_url TEXT := base_url || '/functions/v1/generate-event-embeddings';
    payload JSONB;
BEGIN
    FOR r IN SELECT id, title, description FROM public.events WHERE embedding IS NULL
    LOOP
        payload := jsonb_build_object(
            'type', 'UPDATE',
            'table', 'events',
            'record', jsonb_build_object(
                'id', r.id,
                'title', COALESCE(r.title, ''),
                'description', COALESCE(r.description, '')
            )
        );

        IF EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE p.proname = 'http_post' AND n.nspname = 'net'
        ) THEN
            PERFORM net.http_post(
                url := function_url,
                headers := '{"Content-Type": "application/json"}'::jsonb,
                body := payload
            );
        ELSIF EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE p.proname = 'http_post' AND n.nspname = 'extensions'
        ) THEN
            PERFORM extensions.http_post(
                url := function_url,
                headers := '{"Content-Type": "application/json"}'::jsonb,
                body := payload
            );
        END IF;
    END LOOP;
END;
$$;
