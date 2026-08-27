-- Migration: 20270302000000_club_webhooks.sql
-- Description: Create club_webhooks table and event_rsvps trigger to fire webhooks

-- 1. Create the club_webhooks table
CREATE TABLE IF NOT EXISTS public.club_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('RSVP_CREATED', 'CHECK_IN_COMPLETED')),
  target_url TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by club and event type
CREATE INDEX IF NOT EXISTS idx_club_webhooks_lookup ON public.club_webhooks(club_id, event_type);

-- Setup RLS
ALTER TABLE public.club_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club admins manage their own webhooks"
ON public.club_webhooks FOR ALL
TO authenticated
USING (public.is_club_admin(club_id, auth.uid()))
WITH CHECK (public.is_club_admin(club_id, auth.uid()));

GRANT ALL ON public.club_webhooks TO authenticated;
GRANT ALL ON public.club_webhooks TO service_role;

-- 2. Create the trigger function to queue webhook dispatch edge function calls
CREATE OR REPLACE FUNCTION public.trigger_club_webhooks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type TEXT;
  v_webhook RECORD;
BEGIN
  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.status, 'attending') = 'attending' THEN
      v_event_type := 'RSVP_CREATED';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'attending') THEN
      v_event_type := 'RSVP_CREATED';
    ELSIF (OLD.checked_in = FALSE AND NEW.checked_in = TRUE) THEN
      v_event_type := 'CHECK_IN_COMPLETED';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Loop through active webhooks for this club and event type
  FOR v_webhook IN 
    SELECT target_url, secret_key
    FROM public.club_webhooks
    WHERE club_id = NEW.club_id AND event_type = v_event_type
  LOOP
    -- Queue the background job by calling the Edge Function asynchronously
    PERFORM net.http_post(
      url := COALESCE(current_setting('app.settings.edge_function_url', true), 'http://localhost:54321/functions/v1') || '/publish-club-webhooks',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), '')
      ),
      body := jsonb_build_object(
        'event_type', v_event_type,
        'target_url', v_webhook.target_url,
        'secret_key', v_webhook.secret_key,
        'user_id', NEW.user_id,
        'ticket_tier_id', NEW.ticket_tier_id
      )
    );
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to invoke publish-club-webhooks Edge Function: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create the trigger on event_rsvps table
DROP TRIGGER IF EXISTS trg_on_rsvp_created_or_checked_in ON public.event_rsvps;
CREATE TRIGGER trg_on_rsvp_created_or_checked_in
AFTER INSERT OR UPDATE OF status, checked_in ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.trigger_club_webhooks();
