-- Migration: 20261231000019_suggested_donation_tiers.sql
-- Description: Dynamic Suggested Donation Slider & Tiers (#3599)

-- 1. Add donation_tiers JSONB column and minimum_ticket_price to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS donation_tiers JSONB DEFAULT '[
  {"amount": 10, "impact": "Buys 1 textbook", "icon": "Book"},
  {"amount": 25, "impact": "Provides refreshments for 5 students", "icon": "Coffee"},
  {"amount": 50, "impact": "Funds a laboratory desk & supplies", "icon": "Microscope"},
  {"amount": 100, "impact": "Sponsors a workshop student grant", "icon": "Award"},
  {"amount": 250, "impact": "Funds keynote speaker honorarium", "icon": "Sparkles"},
  {"amount": 500, "impact": "Funds entire student travel stipend", "icon": "Plane"}
]'::jsonb,
ADD COLUMN IF NOT EXISTS min_ticket_price NUMERIC DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS max_donation_amount NUMERIC DEFAULT 1000.00;

-- 2. Function to validate selected donation amount
CREATE OR REPLACE FUNCTION public.validate_event_donation(
    p_event_id UUID,
    p_selected_amount NUMERIC
)
RETURNS TABLE (
    valid BOOLEAN,
    min_required NUMERIC,
    matched_tier_impact TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_min NUMERIC;
    v_tiers JSONB;
    v_tier JSONB;
    v_matched_impact TEXT := 'Generous philanthropic contribution';
BEGIN
    SELECT COALESCE(min_ticket_price, 0), donation_tiers
    INTO v_min, v_tiers
    FROM public.events
    WHERE id = p_event_id;

    IF p_selected_amount < v_min THEN
        RETURN QUERY SELECT FALSE, v_min, NULL::TEXT;
        RETURN;
    END IF;

    -- Find closest tier matching <= selected amount
    IF v_tiers IS NOT NULL AND jsonb_array_length(v_tiers) > 0 THEN
        FOR v_tier IN SELECT * FROM jsonb_array_elements(v_tiers)
        LOOP
            IF (v_tier->>'amount')::NUMERIC <= p_selected_amount THEN
                v_matched_impact := v_tier->>'impact';
            END IF;
        END LOOP;
    END IF;

    RETURN QUERY SELECT TRUE, v_min, v_matched_impact;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_event_donation TO authenticated, anon;
