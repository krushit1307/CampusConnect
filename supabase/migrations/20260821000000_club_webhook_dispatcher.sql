-- ============================================================
-- Migration: Centralized Webhook Dispatcher (Issue #2687)
--
-- Creates:
--   1. `club_integrations` table for storing Discord/Slack webhook URLs.
--   2. RLS policies ensuring webhook URLs are only visible to club admins.
--   3. A Postgres trigger on `events` that fires when status = 'published'.
--   4. The trigger invokes the `club-webhook-dispatcher` Edge Function
--      via pg_net to send a Discord/Slack rich embed.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── Step 1: Create club_integrations table ─────────────────────
CREATE TABLE IF NOT EXISTS public.club_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    provider_type TEXT NOT NULL DEFAULT 'discord'
        CHECK (provider_type IN ('discord', 'slack', 'generic')),
    webhook_url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_integrations_club ON public.club_integrations (club_id, is_active);

ALTER TABLE public.club_integrations ENABLE ROW LEVEL SECURITY;

-- Only club admins can view/manage their integrations.
DROP POLICY IF EXISTS "Club admins can view integrations." ON public.club_integrations;
CREATE POLICY "Club admins can view integrations."
ON public.club_integrations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = club_integrations.club_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    ) OR EXISTS (
        SELECT 1 FROM public.clubs WHERE id = club_integrations.club_id AND created_by = auth.uid()
    )
);

DROP POLICY IF EXISTS "Club admins can insert integrations." ON public.club_integrations;
CREATE POLICY "Club admins can insert integrations."
ON public.club_integrations FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = club_integrations.club_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    ) OR EXISTS (
        SELECT 1 FROM public.clubs WHERE id = club_integrations.club_id AND created_by = auth.uid()
    )
);

DROP POLICY IF EXISTS "Club admins can update integrations." ON public.club_integrations;
CREATE POLICY "Club admins can update integrations."
ON public.club_integrations FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = club_integrations.club_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    ) OR EXISTS (
        SELECT 1 FROM public.clubs WHERE id = club_integrations.club_id AND created_by = auth.uid()
    )
);

DROP POLICY IF EXISTS "Club admins can delete integrations." ON public.club_integrations;
CREATE POLICY "Club admins can delete integrations."
ON public.club_integrations FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = club_integrations.club_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    ) OR EXISTS (
        SELECT 1 FROM public.clubs WHERE id = club_integrations.club_id AND created_by = auth.uid()
    )
);

-- ── Step 2: Trigger function to invoke the Edge Function ───────
CREATE OR REPLACE FUNCTION public.dispatch_event_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_webhook_url TEXT;
    v_club_name TEXT;
    v_dispatcher_url TEXT;
BEGIN
    -- Only fire when the event is transitioning to 'published'
    IF (TG_OP = 'INSERT' AND NEW.status = 'published')
       OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'published') THEN

        -- Fetch the active webhook for this club
        SELECT ci.webhook_url INTO v_webhook_url
        FROM public.club_integrations ci
        WHERE ci.club_id = NEW.club_id
          AND ci.is_active = TRUE
        LIMIT 1;

        -- If no webhook is registered, silently exit
        IF v_webhook_url IS NULL THEN
            RETURN NEW;
        END IF;

        -- Fetch club name for the embed
        SELECT name INTO v_club_name FROM public.clubs WHERE id = NEW.club_id;

        -- Construct the Edge Function URL
        v_dispatcher_url := COALESCE(
            current_setting('app.webhook_dispatcher_url', true),
            'http://localhost:54321/functions/v1/club-webhook-dispatcher'
        );

        -- Fire and forget via pg_net
        PERFORM extensions.net.http_post(
            url := v_dispatcher_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || COALESCE(
                    current_setting('app.service_role_key', true), ''
                )
            ),
            body := jsonb_build_object(
                'event_id', NEW.id,
                'event_title', NEW.title,
                'event_description', NEW.description,
                'event_date', NEW.event_date,
                'event_location', NEW.location,
                'banner_url', NEW.banner_url,
                'club_name', v_club_name,
                'webhook_url', v_webhook_url
            )
        );
    END IF;

    RETURN NEW;
END;
 $$;

DROP TRIGGER IF EXISTS on_event_published_webhook ON public.events;
CREATE TRIGGER on_event_published_webhook
AFTER INSERT OR UPDATE OF status ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_event_webhook();

COMMENT ON TABLE public.club_integrations IS
'Stores Discord/Slack webhook URLs for clubs. Issue #2687.';
COMMENT ON FUNCTION public.dispatch_event_webhook() IS
'AFTER INSERT/UPDATE trigger that fires the webhook dispatcher Edge Function when an event is published. Issue #2687.';

-- ============================================================
-- End of migration
-- ============================================================
