-- Migration: 20261019000000_automated_room_bookings.sql
-- Description: Sets up public.room_booking_requests, alters venues/events tables, configures Citus sharding, triggers and cron reminders.

-- 1. Alter tables
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS facility_manager_email TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS is_off_campus BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS av_requirements TEXT;

-- 2. Create room_booking_requests table
CREATE TABLE IF NOT EXISTS public.room_booking_requests (
    id UUID DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    club_id UUID NOT NULL,
    venue_id UUID NOT NULL REFERENCES public.venues (id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    last_pinged_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT room_booking_requests_pkey PRIMARY KEY (id, club_id),
    CONSTRAINT fk_room_booking_requests_event FOREIGN KEY (event_id, club_id) REFERENCES public.events (id, club_id) ON DELETE CASCADE
);

-- 3. Citus distribution co-location (Skip if already distributed, ignore errors)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'create_distributed_table' AND n.nspname = 'public'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_dist_partition 
            WHERE logicalrelid = 'public.room_booking_requests'::regclass
        ) THEN
            PERFORM create_distributed_table('public.room_booking_requests', 'club_id');
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Citus distribution command failed, skipping.';
END;
$$;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.room_booking_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Booking requests are viewable by club admins." ON public.room_booking_requests;
CREATE POLICY "Booking requests are viewable by club admins." 
ON public.room_booking_requests FOR SELECT
USING (
    public.is_club_admin(club_id, auth.uid()) OR 
    public.is_system_admin()
);

DROP POLICY IF EXISTS "Booking requests are modifyable by club admins." ON public.room_booking_requests;
CREATE POLICY "Booking requests are modifyable by club admins." 
ON public.room_booking_requests FOR ALL
USING (
    public.is_club_admin(club_id, auth.uid()) OR 
    public.is_system_admin()
);

-- 5. Trigger to force status to 'pending_facility_approval' on campus venue bookings
CREATE OR REPLACE FUNCTION public.handle_event_room_booking_status()
RETURNS TRIGGER AS $$
DECLARE
    v_is_off_campus BOOLEAN;
BEGIN
    -- Force status on INSERT if venue is campus-based,
    -- OR on UPDATE if venue_id actually changed and is campus-based.
    IF (TG_OP = 'INSERT' AND NEW.venue_id IS NOT NULL) OR
       (TG_OP = 'UPDATE' AND NEW.venue_id IS DISTINCT FROM OLD.venue_id AND NEW.venue_id IS NOT NULL) THEN
        
        SELECT is_off_campus INTO v_is_off_campus FROM public.venues WHERE id = NEW.venue_id;
        IF v_is_off_campus IS FALSE OR v_is_off_campus IS NULL THEN
            NEW.status := 'pending_facility_approval';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_event_room_booking_status ON public.events;
CREATE TRIGGER trg_handle_event_room_booking_status
BEFORE INSERT OR UPDATE OF venue_id ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_room_booking_status();

-- 6. Trigger to invoke Edge Function
CREATE OR REPLACE FUNCTION public.invoke_room_booking_request_function()
RETURNS TRIGGER AS $$
DECLARE
    v_supabase_url TEXT;
    v_function_url TEXT;
    v_payload JSONB;
BEGIN
    -- Only invoke when status transitions to pending_facility_approval
    IF NEW.status = 'pending_facility_approval' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'pending_facility_approval') THEN
        SELECT value INTO v_supabase_url FROM public.system_settings WHERE key = 'supabase_url';
        IF v_supabase_url IS NULL THEN
            v_supabase_url := 'http://kong:8000';
        END IF;
        v_function_url := v_supabase_url || '/functions/v1/generate-room-request';

        v_payload := jsonb_build_object(
            'event_id', NEW.id,
            'club_id', NEW.club_id
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
            NULL;
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_invoke_room_booking_request_function ON public.events;
CREATE TRIGGER trg_invoke_room_booking_request_function
AFTER INSERT OR UPDATE OF status ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.invoke_room_booking_request_function();

-- 7. Follow-up ping reminder check (pg_cron)
CREATE OR REPLACE FUNCTION public.nudge_pending_room_bookings()
RETURNS void AS $$
DECLARE
    req_row RECORD;
    v_supabase_url TEXT;
    v_function_url TEXT;
    v_payload JSONB;
BEGIN
    SELECT value INTO v_supabase_url FROM public.system_settings WHERE key = 'supabase_url';
    IF v_supabase_url IS NULL THEN
        v_supabase_url := 'http://kong:8000';
    END IF;
    v_function_url := v_supabase_url || '/functions/v1/generate-room-request';

    FOR req_row IN 
        SELECT r.id, r.event_id, r.club_id
        FROM public.room_booking_requests r
        WHERE r.status = 'pending'
          AND r.last_pinged_at < NOW() - INTERVAL '3 days'
    LOOP
        v_payload := jsonb_build_object(
            'event_id', req_row.event_id,
            'club_id', req_row.club_id,
            'is_nudge', true
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

            -- Update last pinged timestamp
            UPDATE public.room_booking_requests
            SET last_pinged_at = NOW()
            WHERE id = req_row.id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cron nudge
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('nudge-pending-room-bookings');
        PERFORM cron.schedule(
            'nudge-pending-room-bookings',
            '0 * * * *',
            $$SELECT public.nudge_pending_room_bookings();$$
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available, skipping cron schedule.';
END;
$$;
