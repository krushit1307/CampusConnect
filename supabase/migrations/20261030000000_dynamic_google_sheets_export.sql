-- Migration: 20261030000000_dynamic_google_sheets_export.sql
-- Description: Set up Google Sheets oauth credentials and dynamic live sync triggers (#3335).

-- 1. Create google_sheets_integrations table
CREATE TABLE IF NOT EXISTS public.google_sheets_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE UNIQUE,
    access_token TEXT,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.google_sheets_integrations ENABLE ROW LEVEL SECURITY;

-- Service role access
DROP POLICY IF EXISTS "service_role has full access to google_sheets_integrations" ON public.google_sheets_integrations;
CREATE POLICY "service_role has full access to google_sheets_integrations"
    ON public.google_sheets_integrations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Club admin access
DROP POLICY IF EXISTS "Club admins can select Google integrations" ON public.google_sheets_integrations;
CREATE POLICY "Club admins can select Google integrations" ON public.google_sheets_integrations
    FOR SELECT TO authenticated
    USING (public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Club admins can insert Google integrations" ON public.google_sheets_integrations;
CREATE POLICY "Club admins can insert Google integrations" ON public.google_sheets_integrations
    FOR INSERT TO authenticated
    WITH CHECK (public.is_club_admin(club_id, auth.uid()));

DROP POLICY IF EXISTS "Club admins can delete Google integrations" ON public.google_sheets_integrations;
CREATE POLICY "Club admins can delete Google integrations" ON public.google_sheets_integrations
    FOR DELETE TO authenticated
    USING (public.is_club_admin(club_id, auth.uid()));

-- 2. Create event_google_sheets table
CREATE TABLE IF NOT EXISTS public.event_google_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
    spreadsheet_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.event_google_sheets ENABLE ROW LEVEL SECURITY;

-- Service role access
DROP POLICY IF EXISTS "service_role has full access to event_google_sheets" ON public.event_google_sheets;
CREATE POLICY "service_role has full access to event_google_sheets"
    ON public.event_google_sheets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated select
DROP POLICY IF EXISTS "Anyone can select event Google sheets" ON public.event_google_sheets;
CREATE POLICY "Anyone can select event Google sheets" ON public.event_google_sheets
    FOR SELECT TO authenticated
    USING (true);

-- Club admin insert/delete
DROP POLICY IF EXISTS "Club admins can manage event Google sheets" ON public.event_google_sheets;
CREATE POLICY "Club admins can manage event Google sheets" ON public.event_google_sheets
    FOR ALL TO authenticated
    USING (public.is_club_admin((SELECT club_id FROM public.events WHERE id = event_google_sheets.event_id), auth.uid()));

-- 3. Create real-time RSVP sync trigger to invoke Edge Function
CREATE OR REPLACE FUNCTION public.trigger_sync_rsvp_to_google_sheet()
RETURNS TRIGGER AS $$
DECLARE
    v_spreadsheet_id TEXT;
    v_club_id UUID;
    v_has_integration BOOLEAN;
BEGIN
    -- Only sync if the RSVP status is 'attending'
    IF NEW.status != 'attending' THEN
        RETURN NEW;
    END IF;

    -- 1. Check if the event has a linked Google Sheet
    SELECT spreadsheet_id INTO v_spreadsheet_id
    FROM public.event_google_sheets
    WHERE event_id = NEW.event_id;

    IF v_spreadsheet_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- 2. Check if the club has a Google Sheets integration configured
    SELECT club_id INTO v_club_id
    FROM public.events
    WHERE id = NEW.event_id;

    SELECT EXISTS(
        SELECT 1 FROM public.google_sheets_integrations WHERE club_id = v_club_id
    ) INTO v_has_integration;

    IF NOT v_has_integration THEN
        RETURN NEW;
    END IF;

    -- 3. Invoke the sync edge function asynchronously
    PERFORM net.http_post(
        url := current_setting('app.settings.edge_function_url', true) || '/sync-rsvp-google-sheets',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
            'event_id', NEW.event_id,
            'user_id', NEW.user_id,
            'status', NEW.status,
            'spreadsheet_id', v_spreadsheet_id,
            'club_id', v_club_id
        )
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to trigger Google Sheets sync: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_rsvp_insert_sync ON public.event_rsvps;
CREATE TRIGGER on_rsvp_insert_sync
    AFTER INSERT OR UPDATE ON public.event_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_sync_rsvp_to_google_sheet();
