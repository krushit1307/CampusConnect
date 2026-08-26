CREATE OR REPLACE FUNCTION public.handle_event_activitypub_broadcast()
RETURNS TRIGGER AS $$
DECLARE
    function_url TEXT := 'http://activitypub:3002/api/activitypub/webhook/event-created';
    payload JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        function_url := 'http://activitypub:3002/api/activitypub/webhook/event-created';
        payload := jsonb_build_object(
            'type', 'INSERT',
            'record', row_to_json(NEW)::jsonb
        );
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        function_url := 'http://activitypub:3002/api/activitypub/webhook/event-updated';
        payload := jsonb_build_object(
            'type', 'UPDATE',
            'record', row_to_json(NEW)::jsonb
        );
    ELSIF TG_OP = 'DELETE' THEN
        function_url := 'http://activitypub:3002/api/activitypub/webhook/event-deleted';
        payload := jsonb_build_object(
            'type', 'DELETE',
            'record', row_to_json(OLD)::jsonb
        );
    ELSE
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'http_post' AND n.nspname = 'net'
    ) THEN
        PERFORM net.http_post(
            url := function_url,
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := payload
        );
    ELSIF EXISTS (
        SELECT 1 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'http_post' AND n.nspname = 'extensions'
    ) THEN
        PERFORM extensions.http_post(
            url := function_url,
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := payload
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_event_activitypub_broadcast ON public.events;

CREATE TRIGGER trg_event_activitypub_broadcast
AFTER INSERT OR DELETE OR UPDATE OF status ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_activitypub_broadcast();
