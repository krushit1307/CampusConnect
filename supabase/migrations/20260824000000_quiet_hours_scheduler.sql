-- Migration: 20260824000000_quiet_hours_scheduler.sql
-- Description: Implement Quiet Hours notification scheduling, delayed notifications table, and pg_cron dispatcher.

-- 1. Alter user_preferences to support quiet hours
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS quiet_hours_start TIME,
ADD COLUMN IF NOT EXISTS quiet_hours_end TIME;

-- 2. Create delayed_notifications queue table
CREATE TABLE IF NOT EXISTS public.delayed_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'push' or 'email'
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS and restrict permissions to service_role / system only
ALTER TABLE public.delayed_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.delayed_notifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.delayed_notifications TO service_role;

-- 3. Create helper RPC to fetch event members with preferences
CREATE OR REPLACE FUNCTION public.get_event_member_preferences(p_event_id UUID)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    full_name TEXT,
    timezone TEXT,
    quiet_hours_start TIME,
    quiet_hours_end TIME
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::TEXT AS email,
    TRIM(CONCAT(p.first_name, ' ', p.last_name))::TEXT AS full_name,
    COALESCE(up.timezone, 'UTC')::TEXT AS timezone,
    up.quiet_hours_start,
    up.quiet_hours_end
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.id
  JOIN public.club_members cm ON cm.user_id = u.id
  JOIN public.events e ON e.club_id = cm.club_id
  LEFT JOIN public.user_preferences up ON up.user_id = u.id
  WHERE e.id = p_event_id
    AND cm.status = 'approved';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_member_preferences(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_member_preferences(UUID) TO service_role;

-- 4. Create the cron dispatch function
CREATE OR REPLACE FUNCTION public.dispatch_delayed_notifications()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row RECORD;
    v_has_net BOOLEAN;
    v_local_time TIME;
    v_user_tz TEXT;
    v_qh_start TIME;
    v_qh_end TIME;
    v_in_quiet_hours BOOLEAN;
    v_url TEXT;
BEGIN
    -- Check if pg_net is available
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'http_post' AND n.nspname = 'net'
    ) INTO v_has_net;

    -- Process pending delayed notifications in batches to avoid timeout/rate limits
    FOR v_row IN 
        SELECT dn.id, dn.user_id, dn.type, dn.payload, 
               COALESCE(up.timezone, 'UTC') AS timezone,
               up.quiet_hours_start, up.quiet_hours_end
        FROM public.delayed_notifications dn
        LEFT JOIN public.user_preferences up ON up.user_id = dn.user_id
        ORDER BY dn.created_at ASC
        LIMIT 100 -- Batch size
    LOOP
        v_user_tz := v_row.timezone;
        v_qh_start := v_row.quiet_hours_start;
        v_qh_end := v_row.quiet_hours_end;
        
        -- Calculate current local time in user's timezone
        BEGIN
            v_local_time := (NOW() AT TIME ZONE v_user_tz)::TIME;
        EXCEPTION WHEN OTHERS THEN
            v_local_time := (NOW() AT TIME ZONE 'UTC')::TIME;
        END;

        -- Check if local time is within quiet hours
        IF v_qh_start IS NOT NULL AND v_qh_end IS NOT NULL THEN
            IF v_qh_start <= v_qh_end THEN
                v_in_quiet_hours := v_local_time >= v_qh_start AND v_local_time <= v_qh_end;
            ELSE
                -- Crossing midnight window (e.g. 23:00 to 07:00)
                v_in_quiet_hours := v_local_time >= v_qh_start OR v_local_time <= v_qh_end;
            END IF;
        ELSE
            v_in_quiet_hours := FALSE;
        END IF;

        -- Dispatch if quiet hours have ended
        IF NOT v_in_quiet_hours THEN
            IF v_has_net THEN
                IF v_row.type = 'push' THEN
                    v_url := 'http://localhost:54321/functions/v1/send-push-notification';
                ELSE
                    v_url := 'http://localhost:54321/functions/v1/send-event-emails';
                END IF;

                PERFORM net.http_post(
                    url := v_url,
                    headers := '{"Content-Type": "application/json"}'::jsonb,
                    body := v_row.payload
                );
            END IF;

            -- Delete the row after successful dispatch attempt
            DELETE FROM public.delayed_notifications WHERE id = v_row.id;
        END IF;
    END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.dispatch_delayed_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_delayed_notifications() TO service_role;

-- 5. Schedule the cron job to run every 15 minutes
DO $$
BEGIN
    PERFORM extensions.cron.schedule('dispatch-delayed-notifications', '*/15 * * * *', 'SELECT public.dispatch_delayed_notifications();');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
