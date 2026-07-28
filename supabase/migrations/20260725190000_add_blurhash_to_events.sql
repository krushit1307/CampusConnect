-- Migration: add_blurhash_to_events.sql
-- Description: Adds a blurhash column to events and wires a Storage upload
-- trigger to the generate-blurhash Edge Function (#1223)

-- 1. Add the blurhash column to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS blurhash TEXT;

-- 2. Ensure pg_net is available so Postgres can call the Edge Function over HTTP
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Trigger function: on new object insert into the event-banners bucket,
--    call the generate-blurhash Edge Function asynchronously via pg_net.
--    Follows the same webhook-secret verification pattern already used
--    elsewhere in this project's Edge Functions (see WEBHOOK_SECRET usage).
CREATE OR REPLACE FUNCTION public.trigger_generate_blurhash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  function_url TEXT := current_setting('app.settings.blurhash_function_url', true);
  webhook_secret TEXT := current_setting('app.settings.webhook_secret', true);
BEGIN
  -- Only fire for the bucket that stores event banners
  IF NEW.bucket_id <> 'event-banners' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := coalesce(function_url, 'https://<project-ref>.supabase.co/functions/v1/generate-blurhash'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(webhook_secret, '')
    ),
    body := jsonb_build_object(
      'bucket_id', NEW.bucket_id,
      'name', NEW.name
    )
  );

  RETURN NEW;
END;
$$;

-- 4. Attach the trigger to storage.objects inserts
DROP TRIGGER IF EXISTS on_event_banner_uploaded ON storage.objects;
CREATE TRIGGER on_event_banner_uploaded
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_generate_blurhash();
  