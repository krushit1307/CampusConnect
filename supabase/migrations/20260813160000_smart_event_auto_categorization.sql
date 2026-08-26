-- Smart Auto-Categorization for Events
-- Runs asynchronously after an event is inserted.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pg_net'
    ) THEN
        CREATE EXTENSION pg_net WITH SCHEMA extensions;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

CREATE OR REPLACE FUNCTION public.handle_event_auto_categorization()
RETURNS TRIGGER AS $$
DECLARE
    function_url TEXT;
    webhook_secret TEXT;
    payload JSONB;
BEGIN
    function_url :=
        current_setting('app.settings.edge_function_url', true)
        || '/smart-auto-categorize';

    webhook_secret :=
        current_setting('app.settings.event_categorizer_webhook_secret', true);

    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'events',
        'record', jsonb_build_object(
            'id', NEW.id,
            'title', NEW.title,
            'description', NEW.description,
            'club_id', NEW.club_id,
            'category_id', NEW.category_id,
            'tags', COALESCE(NEW.tags, '{}'::text[])
        )
    );

    IF function_url IS NULL OR function_url = '/smart-auto-categorize' THEN
        RAISE WARNING 'Smart event categorization URL is not configured.';
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'http_post'
          AND n.nspname = 'net'
    ) THEN
        PERFORM net.http_post(
            url := function_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'x-webhook-secret', COALESCE(webhook_secret, '')
            ),
            body := payload
        );
    ELSIF EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.proname = 'http_post'
          AND n.nspname = 'extensions'
    ) THEN
        PERFORM extensions.http_post(
            url := function_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'x-webhook-secret', COALESCE(webhook_secret, '')
            ),
            body := payload
        );
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING
            'Smart event categorization webhook failed: %',
            SQLERRM;

        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_event_created_auto_categorization
ON public.events;

CREATE TRIGGER on_event_created_auto_categorization
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_auto_categorization();

COMMENT ON FUNCTION public.handle_event_auto_categorization() IS
'Asynchronously sends newly created events to the smart-auto-categorize Edge Function.';