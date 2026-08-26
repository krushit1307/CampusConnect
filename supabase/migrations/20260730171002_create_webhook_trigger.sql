-- Trigger function to asynchronously notify edge function on event insert
CREATE OR REPLACE FUNCTION trigger_publish_webhooks()
RETURNS TRIGGER AS $$
BEGIN
  -- We'll use standard pg_net to POST to our Edge Function if available, 
  -- or fallback to inserting into a generic event queue table.
  -- Here we assume supabase functions can be invoked directly, or we can use pg_net.
  
  -- The Edge Function `publish-webhooks` will be responsible for fetching webhooks 
  -- and sending the payload. We invoke it immediately on event creation.

  PERFORM net.http_post(
      url := current_setting('app.settings.edge_function_url', true) || '/publish-webhooks',
      headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
          'type', 'event.created',
          'record', row_to_json(NEW)
      )
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- In case of failure calling net.http_post (e.g. pg_net not installed), log it or ignore
    RAISE WARNING 'Failed to invoke publish-webhooks Edge Function: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_event_created_publish_webhooks
AFTER INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION trigger_publish_webhooks();
