-- Migration: 20260721000000_welcome_email_webhook_trigger.sql
-- Description: Trigger send-welcome-email Edge Function via net.http_post when a new user profile is created

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send async webhook request to send-welcome-email edge function
CREATE OR REPLACE FUNCTION public.handle_new_user_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
    function_url TEXT := 'http://localhost:54321/functions/v1/send-welcome-email';
BEGIN
    PERFORM net.http_post(
        url := function_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
            'type', 'INSERT',
            'table', 'profiles',
            'record', jsonb_build_object(
                'id', NEW.id,
                'full_name', NEW.full_name,
                'created_at', NEW.created_at
            )
        )
    );
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
