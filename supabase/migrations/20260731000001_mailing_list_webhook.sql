-- Migration: 20260731000000_mailing_list_webhook.sql
-- Description: Trigger sync-mailing-list Edge Function via pg_net HTTP POST when a new user signs up

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

-- Function to send async webhook request to sync-mailing-list edge function
CREATE OR REPLACE FUNCTION public.handle_new_user_mailing_list()
RETURNS TRIGGER AS $$
DECLARE
    function_url TEXT := 'http://localhost:54321/functions/v1/sync-mailing-list';
    payload JSONB;
    opt_in BOOLEAN;
BEGIN
    -- Extract newsletter_opt_in safely
    opt_in := (NEW.raw_user_meta_data->>'newsletter_opt_in')::boolean;
    
    IF opt_in = true THEN
        payload := jsonb_build_object(
            'type', 'INSERT',
            'table', 'users',
            'schema', 'auth',
            'record', jsonb_build_object(
                'id', NEW.id,
                'email', NEW.email,
                'newsletter_opt_in', true
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
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Fail silently to not abort user registration
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user_mailing_list() IS
'Asynchronously triggers sync-mailing-list edge function via pg_net HTTP POST when a new user signs up with newsletter_opt_in = true.';

-- Attach trigger to AFTER INSERT on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created_mailing_list ON auth.users;

CREATE TRIGGER on_auth_user_created_mailing_list
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_mailing_list();
