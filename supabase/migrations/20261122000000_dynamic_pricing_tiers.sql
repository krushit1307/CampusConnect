-- Migration: 20261122000000_dynamic_pricing_tiers.sql
-- Description: Implement dynamic ticket pricing tiers (Issue #3293)

-- 1. Modify ticket_tiers to support dynamic dates and capacity properly
ALTER TABLE public.ticket_tiers
ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- We allow capacity to be null for unlimited capacity
ALTER TABLE public.ticket_tiers
ALTER COLUMN capacity DROP NOT NULL,
ALTER COLUMN capacity DROP DEFAULT;

-- Add a constraint ensuring end_date is after start_date
ALTER TABLE public.ticket_tiers
DROP CONSTRAINT IF EXISTS check_ticket_tier_dates;
ALTER TABLE public.ticket_tiers
ADD CONSTRAINT check_ticket_tier_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date);

-- 2. Add ticket_tier_id to event_rsvps to historically preserve the purchased tier
ALTER TABLE public.event_rsvps
ADD COLUMN IF NOT EXISTS ticket_tier_id UUID REFERENCES public.ticket_tiers(id) ON DELETE SET NULL;

-- 3. RPC to determine the active ticket tier for an event
CREATE OR REPLACE FUNCTION public.get_active_ticket_tier(
    p_event_id UUID,
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    price INT,
    capacity INT,
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
