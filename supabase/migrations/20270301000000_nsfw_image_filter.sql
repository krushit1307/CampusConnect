-- Add status column to event_photos
ALTER TABLE public.event_photos 
ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'quarantined'));

-- Create Webhook Trigger to call the edge function
CREATE OR REPLACE FUNCTION public.trigger_moderate_image()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text;
  v_body text;
BEGIN
  -- We assume the Supabase Edge Function URL is available or use pg_net.
  -- To keep it self-contained for the migration without pg_net extensions explicitly defined here,
  -- we can use the http extension if available, or just use pg_net's http_post.
  
  -- Use pg_net to call the edge function asynchronously
  v_url := current_setting('app.settings.edge_function_base_url', true) || '/moderate-image';
  
  -- Only attempt to call if the URL is configured (otherwise we might be in local dev without it)
  IF v_url IS NOT NULL AND v_url != '/moderate-image' THEN
    v_body := json_build_object(
      'type', 'INSERT',
      'table', 'event_photos',
      'record', row_to_json(NEW)
    )::text;
    
    PERFORM net.http_post(
      url := v_url,
      body := v_body::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the insert if the webhook fails
  RAISE WARNING 'Failed to trigger moderate-image webhook: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on event_photos
DROP TRIGGER IF EXISTS trigger_moderate_image_on_insert ON public.event_photos;
CREATE TRIGGER trigger_moderate_image_on_insert
AFTER INSERT ON public.event_photos
FOR EACH ROW
EXECUTE FUNCTION public.trigger_moderate_image();
