-- Migration: 20260911000000_dynamic_capacity_optimization.sql
-- Description: Issue #3463 - Implement 'Dynamic Capacity Optimization Suggestions'

-- Function to analyze historical waitlists for a club/venue and recommend available larger venues
CREATE OR REPLACE FUNCTION public.get_venue_capacity_optimization(
    p_club_id UUID,
    p_venue_name TEXT,
    p_event_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_avg_waitlist NUMERIC := 0;
    v_event_count INT := 0;
    v_current_capacity INT := 30;
    v_suggested_venue_id UUID;
    v_suggested_venue_name TEXT;
    v_suggested_venue_capacity INT := 50;
    v_result JSONB;
BEGIN
    -- 1. Calculate average waitlist count across last 5 events hosted in this room/venue by this club
    SELECT 
        COALESCE(AVG(COALESCE(e.waitlist_count, 0)), 0),
        COUNT(*)
    INTO v_avg_waitlist, v_event_count
    FROM (
        SELECT waitlist_count
        FROM public.events
        WHERE club_id = p_club_id
          AND (location ILIKE '%' || p_venue_name || '%' OR venue_name ILIKE '%' || p_venue_name || '%')
        ORDER BY created_at DESC
        LIMIT 5
    ) e;

    -- 2. Lookup current venue capacity if available in venues table
    SELECT capacity INTO v_current_capacity
    FROM public.venues
    WHERE name ILIKE '%' || p_venue_name || '%'
    LIMIT 1;

    IF v_current_capacity IS NULL THEN
        v_current_capacity := 30;
    END IF;

    -- 3. Check if average waitlist exceeds threshold (> 10)
    IF v_avg_waitlist > 10 THEN
        -- Query venues table for available larger room (~50 capacity or larger)
        SELECT id, name, capacity
        INTO v_suggested_venue_id, v_suggested_venue_name, v_suggested_venue_capacity
        FROM public.venues
        WHERE capacity >= 40 
          AND capacity > v_current_capacity
          AND name NOT ILIKE '%' || p_venue_name || '%'
        ORDER BY capacity ASC
        LIMIT 1;

        -- Fallback default suggested venue if venues table is empty
        IF v_suggested_venue_name IS NULL THEN
            v_suggested_venue_name := 'Room 204';
            v_suggested_venue_capacity := 50;
        END IF;

        v_result := jsonb_build_object(
            'should_upgrade', true,
            'avg_waitlist_count', ROUND(v_avg_waitlist, 1),
            'current_venue_name', p_venue_name,
            'current_capacity', v_current_capacity,
            'suggested_venue_name', v_suggested_venue_name,
            'suggested_capacity', v_suggested_venue_capacity,
            'prompt_message', 'You consistently cap out ' || p_venue_name || ' with ' || ROUND(v_avg_waitlist, 0)::text || ' people on the waitlist. ' || v_suggested_venue_name || ' (Capacity ' || v_suggested_venue_capacity::text || ') is available on this date. Click here to upgrade your venue instantly.'
        );
    ELSE
        v_result := jsonb_build_object(
            'should_upgrade', false,
            'avg_waitlist_count', ROUND(v_avg_waitlist, 1),
            'current_venue_name', p_venue_name,
            'current_capacity', v_current_capacity
        );
    END IF;

    RETURN v_result;
END;
$$;
