-- Migration: 20260721000000_welcome_email_webhook_trigger.sql
-- Description: Trigger send-welcome-email Edge Function via pg_net HTTP POST when a new user profile is created

-- Safely attempt to enable pg_net extension if available
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        CREATE EXTENSION pg_net WITH SCHEMA extensions;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Extension already loaded or unavailable in current environment
    NULL;
END $$;

-- Function to send async webhook request to send-welcome-email edge function
CREATE OR REPLACE FUNCTION public.handle_new_user_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
    function_url TEXT := 'http://localhost:54321/functions/v1/send-welcome-email';
    payload JSONB;
BEGIN
    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'profiles',
        'record', jsonb_build_object(
            'id', NEW.id,
            'full_name', NEW.full_name,
            'created_at', NEW.created_at
        )
    );

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

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user_welcome_email() IS
'Asynchronously triggers send-welcome-email edge function via pg_net HTTP POST when a new user profile is created.';

-- Attach trigger to AFTER INSERT on profiles table
DROP TRIGGER IF EXISTS on_profile_created_welcome_email ON public.profiles;

CREATE TRIGGER on_profile_created_welcome_email
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_welcome_email();
