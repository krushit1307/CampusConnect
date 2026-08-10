-- Migration: 20260810190000_scheduled_push_notifications.sql
-- Description: Helper RPC functions for scheduled event push notifications and cleanup (#2645)

-- 1. Create function to query upcoming events starting in ~1 hour (45m to 75m window)
CREATE OR REPLACE FUNCTION public.get_upcoming_events_for_push_reminders()
RETURNS TABLE (
    event_id UUID,
    event_title TEXT,
    start_time TIMESTAMPTZ,
    user_id UUID,
    endpoint TEXT,
    p256dh TEXT,
    auth TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id AS event_id,
        e.title AS event_title,
        e.start_time AS start_time,
        r.user_id AS user_id,
        ps.endpoint AS endpoint,
        ps.p256dh AS p256dh,
        ps.auth AS auth
    FROM public.events e
    JOIN public.event_rsvps r ON r.event_id = e.id
    JOIN public.push_subscriptions ps ON ps.user_id = r.user_id
    WHERE e.start_time >= (now() + INTERVAL '45 minutes')
      AND e.start_time <= (now() + INTERVAL '75 minutes')
      AND (r.status IS NULL OR r.status = 'going' OR r.status = 'approved');
END;
$$;

-- 2. Create helper to clean up expired / 410 Gone push subscriptions
CREATE OR REPLACE FUNCTION public.delete_expired_push_subscription(p_endpoint TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.push_subscriptions
    WHERE endpoint = p_endpoint;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_upcoming_events_for_push_reminders() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_expired_push_subscription(TEXT) TO authenticated, service_role;
