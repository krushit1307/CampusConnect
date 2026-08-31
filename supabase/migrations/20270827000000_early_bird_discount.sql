-- Migration: 20270827000000_early_bird_discount.sql
-- Description: Adds ticket_tiers JSONB column to public.events and ticket_tier_name TEXT to public.event_rsvps,
--               and creates a concurrency-safe, row-locking reservation RPC function to prevent race conditions.

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS ticket_tiers JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.event_rsvps 
ADD COLUMN IF NOT EXISTS ticket_tier_name TEXT;

CREATE OR REPLACE FUNCTION public.check_and_reserve_ticket_tier(
    p_event_id UUID,
    p_tier_name TEXT,
    p_quantity INT,
    p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket_tiers JSONB;
    v_tier JSONB;
    v_quantity_limit INT;
    v_sold_count INT;
    v_rsvp_id UUID;
    v_event_title TEXT;
BEGIN
    -- 1. Select and lock the event row to prevent concurrent updates
    SELECT title, ticket_tiers INTO v_event_title, v_ticket_tiers
    FROM public.events
    WHERE id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    -- 2. Find the requested tier in the JSON array
    IF v_ticket_tiers IS NULL OR jsonb_typeof(v_ticket_tiers) != 'array' THEN
        RAISE EXCEPTION 'This event does not have tiered pricing configured';
    END IF;

    -- Find tier with matching name
    v_tier := NULL;
    FOR i IN 0 .. jsonb_array_length(v_ticket_tiers) - 1 LOOP
        IF (v_ticket_tiers->i->>'name') = p_tier_name THEN
            v_tier := v_ticket_tiers->i;
            EXIT;
        END IF;
    END LOOP;

    IF v_tier IS NULL THEN
        RAISE EXCEPTION 'Ticket tier % not found', p_tier_name;
    END IF;

    v_quantity_limit := (v_tier->>'quantity')::INT;

    -- 3. Calculate currently sold + pending paid tickets for this tier
    SELECT count(*)::INT INTO v_sold_count
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND ticket_tier_name = p_tier_name
      AND status != 'CANCELLED';

    -- 4. Check if there is enough capacity remaining
    IF (v_sold_count + p_quantity) > v_quantity_limit THEN
        RAISE EXCEPTION 'Ticket tier % is sold out or has insufficient tickets remaining', p_tier_name;
    END IF;

    -- 5. Insert a pending RSVP record to reserve the slot
    INSERT INTO public.event_rsvps (
        event_id,
        user_id,
        status,
        ticket_tier_name
    ) VALUES (
        p_event_id,
        p_user_id,
        'PENDING',
        p_tier_name
    )
    RETURNING id INTO v_rsvp_id;

    RETURN v_rsvp_id;
END;
$$;
