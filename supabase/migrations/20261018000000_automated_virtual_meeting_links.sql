-- Migration: 20261018000000_automated_virtual_meeting_links.sql
-- Description: Implement schema, Citus distribution, RLS, and trigger for automated virtual meeting links.

-- 1. Add columns to public.events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS virtual_platform TEXT CHECK (virtual_platform IN ('zoom', 'google_meet'));

-- 2. Create club_zoom_integrations table
CREATE TABLE IF NOT EXISTS public.club_zoom_integrations (
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    zoom_account_id TEXT NOT NULL,
    zoom_client_id TEXT NOT NULL,
    zoom_client_secret TEXT NOT NULL,
    access_token TEXT,
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT club_zoom_integrations_pkey PRIMARY KEY (club_id)
);

-- 3. Create virtual_meetings table
CREATE TABLE IF NOT EXISTS public.virtual_meetings (
    id UUID DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    club_id UUID NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('zoom', 'google_meet')),
    meeting_url TEXT NOT NULL,
    meeting_password TEXT,
    provider_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT virtual_meetings_pkey PRIMARY KEY (id, club_id),
    CONSTRAINT fk_virtual_meetings_event FOREIGN KEY (event_id, club_id) REFERENCES public.events (id, club_id) ON DELETE CASCADE
);

-- 4. Citus distribution
-- Check if table is distributed before calling to avoid duplicate distribution errors
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_dist_partition WHERE logicalrelid = 'public.club_zoom_integrations'::regclass) THEN
        PERFORM create_distributed_table('public.club_zoom_integrations', 'club_id');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_dist_partition WHERE logicalrelid = 'public.virtual_meetings'::regclass) THEN
        PERFORM create_distributed_table('public.virtual_meetings', 'club_id');
    END IF;
END;
$$;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.club_zoom_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_meetings ENABLE ROW LEVEL SECURITY;

-- 6. Define RLS Policies

-- club_zoom_integrations Policies: Manageable only by club admins
CREATE POLICY "Club admins can select zoom integrations" ON public.club_zoom_integrations
FOR SELECT USING (public.is_club_admin(club_id, auth.uid()));

CREATE POLICY "Club admins can insert zoom integrations" ON public.club_zoom_integrations
FOR INSERT WITH CHECK (public.is_club_admin(club_id, auth.uid()));

CREATE POLICY "Club admins can update zoom integrations" ON public.club_zoom_integrations
FOR UPDATE USING (public.is_club_admin(club_id, auth.uid())) WITH CHECK (public.is_club_admin(club_id, auth.uid()));

CREATE POLICY "Club admins can delete zoom integrations" ON public.club_zoom_integrations
FOR DELETE USING (public.is_club_admin(club_id, auth.uid()));

-- virtual_meetings Policies
-- SELECT: Admins OR Event Creator OR Approved RSVPs within 10 minutes of start
CREATE POLICY "Select virtual meetings link policy" ON public.virtual_meetings
FOR SELECT USING (
    -- A. User is club admin
    public.is_club_admin(club_id, auth.uid())
    -- B. User is the event creator
    OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.club_id = virtual_meetings.club_id
          AND e.id = virtual_meetings.event_id
          AND e.created_by = auth.uid()
    )
    -- C. User is an approved attendee and start time is starting in <= 10 mins and event has not finished
    OR EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.event_rsvps r ON r.event_id = e.id AND r.club_id = e.club_id
        WHERE e.club_id = virtual_meetings.club_id
          AND e.id = virtual_meetings.event_id
          AND r.user_id = auth.uid()
          AND r.status = 'approved'
          AND NOW() >= (e.start_date - INTERVAL '10 minutes')
          AND NOW() <= e.end_date
    )
);

-- ALL/WRITE: Manageable only by club admins or event creator
CREATE POLICY "Insert/Update/Delete virtual meetings policy" ON public.virtual_meetings
FOR ALL USING (
    public.is_club_admin(club_id, auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.club_id = virtual_meetings.club_id
          AND e.id = virtual_meetings.event_id
          AND e.created_by = auth.uid()
    )
);

-- 7. Trigger to automatically invoke Edge Function
CREATE OR REPLACE FUNCTION public.handle_meeting_link_generation_on_event_change()
RETURNS TRIGGER AS $$
DECLARE
    v_supabase_url TEXT;
    v_function_url TEXT;
    v_payload JSONB;
BEGIN
    -- Only trigger link generation if event is marked as virtual on insert or flipped to virtual on update
    IF (TG_OP = 'INSERT' AND NEW.is_virtual = TRUE) OR 
       (TG_OP = 'UPDATE' AND OLD.is_virtual = FALSE AND NEW.is_virtual = TRUE) THEN
        
        v_supabase_url := COALESCE(
            current_setting('app.settings.supabase_url', true),
            'http://kong:8000'
        );
        v_function_url := v_supabase_url || '/functions/v1/generate-meeting-link';

        v_payload := jsonb_build_object(
            'event_id', NEW.id,
            'club_id', NEW.club_id,
            'title', NEW.title,
            'start_date', NEW.start_date,
            'end_date', NEW.end_date,
            'virtual_platform', COALESCE(NEW.virtual_platform, 'zoom')
        );

        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
                WHERE p.proname = 'http_post' AND n.nspname = 'net'
            ) THEN
                PERFORM net.http_post(
                    url := v_function_url,
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), '')
                    ),
                    body := v_payload
                );
            ELSIF EXISTS (
                SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
                WHERE p.proname = 'http_post' AND n.nspname = 'extensions'
            ) THEN
                PERFORM extensions.http_post(
                    url := v_function_url,
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), '')
                    ),
                    body := v_payload
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Gracefully swallow webhook errors to prevent blocking transaction
            NULL;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Register the trigger
DROP TRIGGER IF EXISTS trg_handle_meeting_link_generation_on_event_change ON public.events;

CREATE TRIGGER trg_handle_meeting_link_generation_on_event_change
AFTER INSERT OR UPDATE OF is_virtual ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_meeting_link_generation_on_event_change();
