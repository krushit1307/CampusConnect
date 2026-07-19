-- ============================================================
-- Migration: 20260718000001_club_registration_webhook.sql
-- Description:
-- Sets up a Supabase Database Webhook (using pg_net) that fires
-- on INSERT to the clubs table to notify when a new club is created.
-- ============================================================

-- Enable pg_net extension in extensions schema if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create the trigger function that sends the POST request to the mock endpoint
CREATE OR REPLACE FUNCTION public.handle_new_club_registration()
RETURNS TRIGGER AS $$
DECLARE
    -- Mock URL fallback, which can be modified in production to point to a Discord webhook
    webhook_url TEXT := 'https://httpbin.org/post';
BEGIN
    PERFORM net.http_post(
        url := webhook_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
            'event', 'club_registered',
            'club_id', NEW.id,
            'club_name', NEW.name,
            'club_slug', NEW.slug,
            'created_by', NEW.created_by,
            'created_at', NEW.created_at
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining trigger function
COMMENT ON FUNCTION public.handle_new_club_registration() IS
'Sends an asynchronous HTTP POST request to a webhook endpoint when a new club is registered.';

-- Create the trigger on INSERT to clubs table
DROP TRIGGER IF EXISTS on_club_created ON public.clubs;

CREATE TRIGGER on_club_created
AFTER INSERT ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_club_registration();
