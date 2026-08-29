-- ============================================================
-- Migration: 20270308000000_dynamic_pricing.sql
-- Issue: #4222 — Real-Time "Dynamic Pricing" Ticketing Engine
-- ============================================================

BEGIN;

-- 1. Add columns to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS base_price INTEGER,
ADD COLUMN IF NOT EXISTS surge_multiplier NUMERIC DEFAULT 0.0;

-- Add check constraints to ensure values make sense
ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS check_events_dynamic_pricing;

ALTER TABLE public.events
ADD CONSTRAINT check_events_dynamic_pricing
CHECK (
  (base_price IS NULL OR base_price >= 0) AND
  (surge_multiplier IS NULL OR surge_multiplier >= 0)
);

-- 2. Create function to calculate current price dynamically
CREATE OR REPLACE FUNCTION public.calculate_current_price(p_event_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_price INTEGER;
  v_surge_multiplier NUMERIC;
  v_capacity INTEGER;
  v_sold_count INTEGER;
  v_current_price INTEGER;
BEGIN
  -- Fetch event base price, surge multiplier, and capacity
  SELECT base_price, surge_multiplier, COALESCE(max_attendees, 100)
  INTO v_base_price, v_surge_multiplier, v_capacity
  FROM public.events
  WHERE id = p_event_id;

  -- If the event is not found or dynamic pricing is not active, return active ticket tier price or 0
  IF v_base_price IS NULL THEN
    SELECT price INTO v_current_price
    FROM public.get_active_ticket_tier(p_event_id)
    LIMIT 1;
    RETURN COALESCE(v_current_price, 0);
  END IF;

  -- Fetch count of tickets sold for this event
  SELECT COUNT(*)::INTEGER INTO v_sold_count
  FROM public.event_rsvps
  WHERE event_id = p_event_id;

  -- Ensure capacity is greater than zero to avoid division by zero
  IF v_capacity <= 0 THEN
    v_capacity := 100;
  END IF;

  -- Calculate current price: Base Price * (1 + (Tickets Sold / Venue Capacity) * Surge Multiplier)
  v_current_price := ROUND(v_base_price * (1 + (v_sold_count::NUMERIC / v_capacity::NUMERIC) * COALESCE(v_surge_multiplier, 0.0)))::INTEGER;

  RETURN v_current_price;
END;
$$;

-- 3. Create function to determine remaining tickets until next price increase
CREATE OR REPLACE FUNCTION public.tickets_until_price_increase(p_event_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_price INTEGER;
  v_surge_multiplier NUMERIC;
  v_capacity INTEGER;
  v_sold_count INTEGER;
  v_current_price INTEGER;
  v_next_price INTEGER;
  v_temp_price INTEGER;
  v_step INTEGER;
BEGIN
  SELECT base_price, surge_multiplier, COALESCE(max_attendees, 100)
  INTO v_base_price, v_surge_multiplier, v_capacity
  FROM public.events
  WHERE id = p_event_id;

  -- Return null if dynamic pricing or surge multiplier is not active
  IF v_base_price IS NULL OR v_surge_multiplier IS NULL OR v_surge_multiplier = 0 THEN
    RETURN NULL;
  END IF;

  IF v_capacity <= 0 THEN
    v_capacity := 100;
  END IF;

  -- Fetch count of tickets sold
  SELECT COUNT(*)::INTEGER INTO v_sold_count
  FROM public.event_rsvps
  WHERE event_id = p_event_id;

  -- Get current dynamic price
  v_current_price := ROUND(v_base_price * (1 + (v_sold_count::NUMERIC / v_capacity::NUMERIC) * v_surge_multiplier))::INTEGER;

  -- Try to find when the price increases to the next whole dollar (100 cents) increment
  v_next_price := (FLOOR(v_current_price / 100.0) + 1) * 100;

  FOR v_step IN 1..(v_capacity - v_sold_count) LOOP
    v_temp_price := ROUND(v_base_price * (1 + ((v_sold_count + v_step)::NUMERIC / v_capacity::NUMERIC) * v_surge_multiplier))::INTEGER;
    IF v_temp_price >= v_next_price THEN
      RETURN v_step;
    END IF;
  END LOOP;

  -- Fallback: check when the price increases by any non-zero amount
  FOR v_step IN 1..(v_capacity - v_sold_count) LOOP
    v_temp_price := ROUND(v_base_price * (1 + ((v_sold_count + v_step)::NUMERIC / v_capacity::NUMERIC) * v_surge_multiplier))::INTEGER;
    IF v_temp_price > v_current_price THEN
      RETURN v_step;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_current_price(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tickets_until_price_increase(UUID) TO anon, authenticated;

COMMIT;
