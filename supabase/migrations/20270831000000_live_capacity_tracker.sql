-- Migration: 20270831000000_live_capacity_tracker.sql
-- Description: Real-Time Attendee Density Tracker (#3888).
-- Reuses the existing event_rsvps.checked_in flag (set by the door-scanning
-- flow in verify-ticket-challenge, #3016) and events.venue_capacity
-- (added in 20260835000000_room_capacity_warnings.sql) to compute a live
-- capacity percentage for the public event page.

CREATE OR REPLACE FUNCTION public.get_live_capacity(
    p_event_id UUID
)
RETURNS TABLE (
    actual_check_ins INTEGER,
    venue_capacity INTEGER,
    capacity_percentage NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_check_ins INTEGER;
    v_capacity INTEGER;
BEGIN
    -- Count tickets actually scanned/checked-in at the door for this event
    SELECT COALESCE(COUNT(*), 0)::INTEGER
    INTO v_check_ins
    FROM public.event_rsvps
    WHERE event_id = p_event_id AND checked_in = TRUE;

    SELECT venue_capacity
    INTO v_capacity
    FROM public.events
    WHERE id = p_event_id;

    IF v_capacity IS NULL OR v_capacity <= 0 THEN
        v_capacity := 0;
    END IF;

    RETURN QUERY SELECT
        v_check_ins,
        v_capacity,
        CASE
            WHEN v_capacity > 0 THEN ROUND((v_check_ins::NUMERIC / v_capacity::NUMERIC) * 100, 1)
            ELSE 0
        END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_capacity(UUID) TO anon, authenticated, service_role;

-- Make sure check-in updates broadcast to the public event page in real time
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add event_rsvps to Realtime publication: %', SQLERRM;
END;
$$;