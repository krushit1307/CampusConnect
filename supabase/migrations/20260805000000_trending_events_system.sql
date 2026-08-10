-- Migration: Trending Events System
-- Description: Sets up pg_net webhooks for event RSVPs and Likes to update Redis trending scores via Edge Function, and schedules decay.

-- 1. Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 2. Create the webhook trigger function
CREATE OR REPLACE FUNCTION public.trigger_trending_score_update()
RETURNS TRIGGER AS $$
DECLARE
  v_payload JSONB;
  v_event_id UUID;
  v_action TEXT;
BEGIN
  -- Determine action and event_id based on the table
  IF TG_TABLE_NAME = 'event_rsvps' THEN
    v_action := 'rsvp';
    v_event_id := NEW.event_id;
  ELSIF TG_TABLE_NAME = 'likes' THEN
    -- Only process likes for events
    IF NEW.entity_type != 'event' THEN
      RETURN NEW;
    END IF;
    v_action := 'like';
    v_event_id := NEW.entity_id;
  END IF;

  -- Build payload
  v_payload := jsonb_build_object(
    'event_id', v_event_id,
    'action', v_action
  );

  -- Perform asynchronous HTTP POST to Edge Function using pg_net
  -- Note: We use a placeholder URL, which is dynamically resolved in Supabase
  -- If using a local environment, 'http://kong:8000/functions/v1/update-trending-score' or similar
  -- For production, it's typically 'https://<project>.supabase.co/functions/v1/update-trending-score'
  -- Here we assume a valid environment variable or internal resolution, 
  -- but a robust way is to rely on an environment variable or a known host.
  -- To keep it universal, we'll hit the internal Kong endpoint (if local) or assume it's configured.
  
  -- But actually, hardcoding the URL is tricky. We can use a secure token or just assume it's publicly accessible or uses anon key.
  -- Supabase pg_net requires full URL.
  
  PERFORM net.http_post(
      url := current_setting('app.settings.edge_function_base_url', true) || '/update-trending-score',
      body := v_payload,
      headers := jsonb_build_object(
          'Content-Type', 'application/json'
          -- Add auth headers if needed
      )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the transaction
  RAISE WARNING 'Failed to trigger trending score update: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach triggers to event_rsvps and likes
DROP TRIGGER IF EXISTS on_event_rsvp_trending_update ON public.event_rsvps;
CREATE TRIGGER on_event_rsvp_trending_update
AFTER INSERT ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.trigger_trending_score_update();

DROP TRIGGER IF EXISTS on_like_trending_update ON public.likes;
CREATE TRIGGER on_like_trending_update
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.trigger_trending_score_update();

-- (Note: Comments table only has post_id, so we cannot trigger event score updates from comments in this schema)

-- 4. Schedule hourly decay via pg_cron
-- We call the trending-decay Edge Function every hour
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Schedule cron to call the decay function every hour at minute 0
    -- This relies on net.http_post as well.
    PERFORM cron.schedule(
      'trending_events_decay_hourly',
      '0 * * * *',
      $$
        SELECT net.http_post(
          url := current_setting('app.settings.edge_function_base_url', true) || '/trending-decay',
          headers := '{"Content-Type": "application/json"}'::jsonb
        );
      $$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not active; skipping cron schedule.';
  END IF;
END $$;
