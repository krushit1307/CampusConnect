-- Migration: 20270115000000_accessibility_needs_aggregator.sql
-- Description: Implement aggregate_event_logistics RPC for event logistics aggregator (#3611).

CREATE OR REPLACE FUNCTION public.aggregate_event_logistics(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dietary JSONB;
    v_access JSONB;
    v_total INTEGER;
    v_result JSONB;
BEGIN
    -- 1. Count total registered RSVPs (status = attending/registered or checkin states)
    SELECT COALESCE(COUNT(*), 0)::INTEGER
    INTO v_total
    FROM public.event_rsvps
    WHERE event_id = p_event_id AND status IN ('attending', 'registered');

    -- 2. Aggregate dietary requirements
    -- Fetch from banquet tables seat assignments first
    SELECT COALESCE(jsonb_object_agg(tag, cnt), '{}'::jsonb)
    INTO v_dietary
    FROM (
        SELECT trim(both ' ' from unnest(bsa.dietary_needs)) AS tag, COUNT(*)::INTEGER AS cnt
        FROM public.banquet_seat_assignments bsa
        JOIN public.banquet_tables bt ON bsa.table_id = bt.id
        WHERE bt.event_id = p_event_id AND bsa.dietary_needs IS NOT NULL
        GROUP BY tag
    ) d;

    -- If empty, check if there are general dietary requests in accommodation_requests
    IF v_dietary = '{}'::jsonb THEN
        SELECT COALESCE(jsonb_object_agg(
            CASE 
                WHEN private_note IS NOT NULL AND private_note <> '' THEN private_note
                ELSE 'Dietary Medical'
            END, cnt), '{}'::jsonb)
        INTO v_dietary
        FROM (
            SELECT private_note, COUNT(*)::INTEGER AS cnt
            FROM public.accommodation_requests
            WHERE event_id = p_event_id AND accommodation_type = 'DIETARY_MEDICAL' AND state <> 'WITHDRAWN'
            GROUP BY private_note
        ) da;
    END IF;

    -- 3. Aggregate accessibility requirements
    SELECT COALESCE(jsonb_object_agg(
        CASE 
            WHEN accommodation_type = 'ASL_INTERPRETER' THEN 'ASL Interpreter'
            WHEN accommodation_type = 'WHEELCHAIR_SEATING' THEN 'Wheelchair Access'
            WHEN accommodation_type = 'CART_CAPTIONING' THEN 'CART Captioning'
            WHEN accommodation_type = 'ASSISTIVE_LISTENING' THEN 'Assistive Listening'
            WHEN accommodation_type = 'COMPANION_SEAT' THEN 'Companion Seat'
            WHEN accommodation_type = 'PERSONAL_AIDE' THEN 'Personal Aide'
            WHEN accommodation_type = 'SERVICE_ANIMAL' THEN 'Service Animal'
            WHEN accommodation_type = 'QUIET_ROOM' THEN 'Quiet Room'
            WHEN accommodation_type = 'LARGE_PRINT_MATERIALS' THEN 'Large Print Materials'
            ELSE accommodation_type
        END, cnt), '{}'::jsonb)
    INTO v_access
    FROM (
        SELECT accommodation_type, COUNT(*)::INTEGER AS cnt
        FROM public.accommodation_requests
        WHERE event_id = p_event_id AND accommodation_type <> 'DIETARY_MEDICAL' AND state <> 'WITHDRAWN'
        GROUP BY accommodation_type
    ) a;

    -- 4. Combine into final result
    v_result := jsonb_build_object(
        'total_registered', v_total,
        'dietary', v_dietary,
        'accessibility', v_access
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aggregate_event_logistics(UUID) TO authenticated, service_role;
