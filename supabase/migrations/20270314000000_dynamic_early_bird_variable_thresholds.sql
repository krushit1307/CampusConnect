-- Migration: 20270314000000_dynamic_early_bird_variable_thresholds.sql
-- Description: Implement Dynamic 'Early Bird' Variable Thresholds (Issue #4530)
-- Allows inventory tiers to define capacity as a percentage of total Venue Capacity
-- and automatically recalculate limits when venue capacity changes.

-- 1. Modify ticket_tiers to accept capacity_percentage and dynamic capacity flag
ALTER TABLE public.ticket_tiers
ADD COLUMN IF NOT EXISTS capacity_percentage NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS is_dynamic_capacity BOOLEAN NOT NULL DEFAULT FALSE;

-- Add constraint to ensure capacity_percentage is between 0.01% and 100%
ALTER TABLE public.ticket_tiers
DROP CONSTRAINT IF EXISTS check_capacity_percentage;
ALTER TABLE public.ticket_tiers
ADD CONSTRAINT check_capacity_percentage CHECK (
    capacity_percentage IS NULL OR (capacity_percentage > 0 AND capacity_percentage <= 100)
);

-- 2. Function to recalculate ticket tier capacities for an event
CREATE OR REPLACE FUNCTION public.recalculate_ticket_tier_capacities(
    p_event_id UUID,
    p_venue_capacity INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_venue_capacity IS NULL OR p_venue_capacity <= 0 THEN
        RETURN;
    END IF;

    UPDATE public.ticket_tiers
    SET 
        capacity = GREATEST(1, ROUND(p_venue_capacity * (capacity_percentage / 100.0))::INT),
        is_dynamic_capacity = TRUE
    WHERE event_id = p_event_id
      AND capacity_percentage IS NOT NULL
      AND capacity_percentage > 0;
END;
$$;

-- 3. Trigger on events when venue_capacity or max_attendees changes
CREATE OR REPLACE FUNCTION public.trg_sync_event_venue_capacity_to_tiers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cap INT;
BEGIN
    v_cap := COALESCE(NEW.venue_capacity, NEW.max_attendees);
    IF v_cap IS NOT NULL AND (OLD.venue_capacity IS DISTINCT FROM NEW.venue_capacity OR OLD.max_attendees IS DISTINCT FROM NEW.max_attendees) THEN
        PERFORM public.recalculate_ticket_tier_capacities(NEW.id, v_cap);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_venue_capacity_tier_sync ON public.events;
CREATE TRIGGER trg_event_venue_capacity_tier_sync
AFTER INSERT OR UPDATE OF venue_capacity, max_attendees ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_event_venue_capacity_to_tiers();

-- 4. Trigger on ticket_tiers before INSERT or UPDATE to calculate capacity if capacity_percentage is set
CREATE OR REPLACE FUNCTION public.trg_calc_dynamic_tier_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_venue_cap INT;
BEGIN
    IF NEW.capacity_percentage IS NOT NULL AND NEW.capacity_percentage > 0 THEN
        SELECT COALESCE(venue_capacity, max_attendees) INTO v_venue_cap
        FROM public.events
        WHERE id = NEW.event_id;

        IF v_venue_cap IS NOT NULL AND v_venue_cap > 0 THEN
            NEW.capacity := GREATEST(1, ROUND(v_venue_cap * (NEW.capacity_percentage / 100.0))::INT);
            NEW.is_dynamic_capacity := TRUE;
        END IF;
    ELSE
        NEW.is_dynamic_capacity := FALSE;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_tier_dynamic_capacity_calc ON public.ticket_tiers;
CREATE TRIGGER trg_ticket_tier_dynamic_capacity_calc
BEFORE INSERT OR UPDATE OF capacity_percentage, event_id ON public.ticket_tiers
FOR EACH ROW
EXECUTE FUNCTION public.trg_calc_dynamic_tier_capacity();

-- 5. Update get_active_ticket_tier to return capacity_percentage and is_dynamic_capacity
CREATE OR REPLACE FUNCTION public.get_active_ticket_tier(
    p_event_id UUID,
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    price INT,
    capacity INT,
    capacity_percentage NUMERIC(5,2),
    is_dynamic_capacity BOOLEAN,
    sold_count INT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    discount_rules JSONB
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH TierStats AS (
        SELECT 
            t.id,
            t.name,
            t.price,
            t.capacity,
            t.capacity_percentage,
            t.is_dynamic_capacity,
            t.start_date,
            t.end_date,
            t.discount_rules,
            (SELECT count(*)::int FROM public.event_rsvps r WHERE r.ticket_tier_id = t.id) as sold_count
        FROM public.ticket_tiers t
        WHERE t.event_id = p_event_id
    )
    SELECT 
        ts.id,
        ts.name,
        ts.price,
        ts.capacity,
        ts.capacity_percentage,
        ts.is_dynamic_capacity,
        ts.sold_count,
        ts.start_date,
        ts.end_date,
        ts.discount_rules
    FROM TierStats ts
    WHERE (ts.start_date IS NULL OR p_now >= ts.start_date)
      AND (ts.end_date IS NULL OR p_now < ts.end_date)
      AND (ts.capacity IS NULL OR ts.sold_count < ts.capacity)
    ORDER BY ts.start_date ASC NULLS LAST
    LIMIT 1;
END;
$$;
