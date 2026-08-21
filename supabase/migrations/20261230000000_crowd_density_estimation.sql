-- Migration: 20261230000000_crowd_density_estimation.sql
-- Description: Implement live crowd density estimation based on checked-in count and venue square footage (#3558).

-- 1. Add square_footage to public.venues
ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS square_footage INTEGER;

-- Backfill existing venues with a default/reasonable square footage (e.g. 2000 sq ft)
UPDATE public.venues
SET square_footage = 2000
WHERE square_footage IS NULL;

-- 2. Build live density calculator RPC
CREATE OR REPLACE FUNCTION public.get_live_density(
    p_event_id UUID
)
RETURNS TABLE (
    checked_in_count INTEGER,
    square_footage INTEGER,
    density_ratio NUMERIC,
    density_status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_checked_in_count INTEGER;
    v_sq_ft INTEGER;
    v_ratio NUMERIC;
    v_status TEXT;
BEGIN
    -- Count checked-in RSVPs for this event
    SELECT COALESCE(COUNT(*), 0)::INTEGER
    INTO v_checked_in_count
    FROM public.event_rsvps
    WHERE event_id = p_event_id AND checked_in = TRUE;

    -- Get venue square footage
    SELECT COALESCE(v.square_footage, 2000)
    INTO v_sq_ft
    FROM public.events e
    LEFT JOIN public.venues v ON e.venue_id = v.id
    WHERE e.id = p_event_id;

    -- Handle case where event is not found or has no venue
    IF v_sq_ft IS NULL OR v_sq_ft <= 0 THEN
        v_sq_ft := 2000; -- default fallback
    END IF;

    -- Calculate ratio (people per sq ft)
    v_ratio := ROUND(v_checked_in_count::NUMERIC / v_sq_ft::NUMERIC, 4);

    -- Classify status based on 1 person per X sq ft thresholds:
    -- Red (Packed): >= 0.1 people per sq ft (1 person per 10 sq ft or less)
    -- Yellow (Getting Busy): >= 0.04 and < 0.1 people per sq ft (1 person per 25 sq ft to 10 sq ft)
    -- Green (Plenty of Space): < 0.04 people per sq ft (less than 1 person per 25 sq ft)
    IF v_ratio >= 0.1 THEN
        v_status := 'Packed';
    ELSIF v_ratio >= 0.04 THEN
        v_status := 'Getting Busy';
    ELSE
        v_status := 'Plenty of Space';
    END IF;

    RETURN QUERY SELECT v_checked_in_count, v_sq_ft, v_ratio, v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_density(UUID) TO authenticated, service_role;
