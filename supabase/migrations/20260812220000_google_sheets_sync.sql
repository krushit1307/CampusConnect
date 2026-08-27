-- Migration: 20260812220000_google_sheets_sync.sql
-- Description: Create club_integrations, event_sheets_sync, and google_sheets_queue tables,
--               with trigger to queue real-time RSVP updates for Google Sheets batch sync (#3012).

-- 1. Create club_integrations table for OAuth tokens
CREATE TABLE IF NOT EXISTS public.club_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'google_sheets',
    refresh_token TEXT,
    access_token TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (club_id, provider)
);

-- 2. Create event_sheets_sync table
CREATE TABLE IF NOT EXISTS public.event_sheets_sync (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    spreadsheet_id TEXT NOT NULL,
    spreadsheet_url TEXT,
    sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT DEFAULT 'active', -- active, paused_auth_error, error
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (event_id)
);

-- 3. Create google_sheets_queue table for batching rate-limited updates
CREATE TABLE IF NOT EXISTS public.google_sheets_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    rsvp_id UUID REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'INSERT' or 'UPDATE'
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.club_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sheets_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_sheets_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club admins can manage integrations" ON public.club_integrations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Club admins can manage sheets sync" ON public.event_sheets_sync FOR ALL USING (auth.role() = 'authenticated');

-- 4. Database Trigger Function on event_rsvps to queue real-time sync events
CREATE OR REPLACE FUNCTION public.queue_rsvp_google_sheets_sync()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_sync_enabled BOOLEAN := FALSE;
BEGIN
    -- Check if sync is enabled for this event
    SELECT sync_enabled INTO v_sync_enabled
    FROM public.event_sheets_sync
    WHERE event_id = NEW.event_id AND status = 'active';

    IF v_sync_enabled THEN
        INSERT INTO public.google_sheets_queue (
            event_id,
            rsvp_id,
            action,
            payload,
            processed
        )
        VALUES (
            NEW.event_id,
            NEW.id,
            TG_OP,
            jsonb_build_object(
                'rsvp_id', NEW.id,
                'user_id', NEW.user_id,
                'status', NEW.status,
                'ticket_type', COALESCE(NEW.ticket_type, 'General Admission'),
                'updated_at', NOW()
            ),
            FALSE
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Attach trigger to event_rsvps table
DROP TRIGGER IF EXISTS trg_queue_rsvp_google_sheets ON public.event_rsvps;
CREATE TRIGGER trg_queue_rsvp_google_sheets
    AFTER INSERT OR UPDATE ON public.event_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION public.queue_rsvp_google_sheets_sync();
