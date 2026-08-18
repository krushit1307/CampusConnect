-- =============================================================================
-- Migration: Automated No-Show Penalty System
-- Issue: #3330 - Implement 'Automated No-Show Penalty' System
-- Description: Adds penalty tracking to user profiles. Includes an RPC to 
-- process no-shows 24 hours after an event ends and enforce 30-day suspensions.
-- =============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS no_show_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS rsvp_suspended_until TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.no_show_count IS 'Accumulated strikes for RSVPing and failing to check in.';
COMMENT ON COLUMN public.profiles.rsvp_suspended_until IS 'Timestamp until which the user cannot RSVP to new events.';

-- RPC: Process No-Shows for a specific event
CREATE OR REPLACE FUNCTION public.process_event_no_shows(p_event_id UUID)
RETURNS INT AS $$
DECLARE
    v_no_show_users UUID[];
    v_suspension_interval INTERVAL := '30 days';
    v_updated_count INT := 0;
BEGIN
    -- Find users who RSVP'd but never checked in
    SELECT ARRAY_AGG(user_id) INTO v_no_show_users
    FROM public.event_rsvps
    WHERE event_id = p_event_id 
      AND status = 'registered' 
      AND checked_in = FALSE;

    IF v_no_show_users IS NULL OR array_length(v_no_show_users, 1) IS NULL THEN
        RETURN 0;
    END IF;

    -- Increment no_show_count for all offenders
    UPDATE public.profiles
    SET no_show_count = no_show_count + 1,
        rsvp_suspended_until = CASE 
            WHEN (no_show_count + 1) >= 3 THEN NOW() + v_suspension_interval
            ELSE rsvp_suspended_until
        END
    WHERE id = ANY(v_no_show_users);

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    -- Update RSVP status to 'no_show' for historical accuracy
    UPDATE public.event_rsvps
    SET status = 'no_show'
    WHERE event_id = p_event_id AND user_id = ANY(v_no_show_users);

    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
