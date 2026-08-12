-- Migration: 20260812190000_dynamic_early_bird_pricing.sql
-- Description: Add price_schedule JSONB column to ticket_tiers and RPC function
--               for dynamic time-based early-bird pricing evaluation (#3003).

-- 1. Create ticket_tiers table if not exists and add price_schedule column
CREATE TABLE IF NOT EXISTS public.ticket_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price INT NOT NULL DEFAULT 0, -- price in cents
    capacity INT NOT NULL DEFAULT 100,
    description TEXT,
    is_early_bird BOOLEAN DEFAULT FALSE,
    early_bird_end_date TIMESTAMPTZ,
    price_schedule JSONB DEFAULT '[]'::jsonb, -- e.g. [{"price": 1000, "end_date": "2026-11-01T00:00:00Z"}, {"price": 1500, "end_date": null}]
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure price_schedule column exists if table was pre-existing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'ticket_tiers' AND column_name = 'price_schedule'
    ) THEN
        ALTER TABLE public.ticket_tiers ADD COLUMN price_schedule JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. RPC function to calculate active ticket price at a given timestamp (in UTC)
CREATE OR REPLACE FUNCTION public.calculate_active_ticket_price(
    p_price_schedule JSONB,
    p_default_price INT,
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    active_price INT,
    is_early_bird BOOLEAN,
    next_price INT,
    ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    item JSONB;
    v_active_price INT := p_default_price;
    v_is_early_bird BOOLEAN := FALSE;
    v_next_price INT := NULL;
    v_ends_at TIMESTAMPTZ := NULL;
BEGIN
    IF p_price_schedule IS NOT NULL AND jsonb_array_length(p_price_schedule) > 0 THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_price_schedule)
        LOOP
            IF item->>'end_date' IS NOT NULL THEN
                v_ends_at := (item->>'end_date')::TIMESTAMPTZ;
                IF p_now < v_ends_at THEN
                    v_active_price := (item->>'price')::INT;
                    v_is_early_bird := TRUE;
                    EXIT;
                END IF;
            ELSE
                -- Default fallback schedule tier
                v_active_price := (item->>'price')::INT;
            END IF;
        END LOOP;
    END IF;

    RETURN QUERY SELECT v_active_price, v_is_early_bird, v_next_price, v_ends_at;
END;
$$;
