-- =============================================================================
-- Migration: 20270910000000_dutch_auction_system.sql
-- Description: Issue #5004 - Real-Time "Dynamic Pricing" Dutch Auction Engine
-- =============================================================================

BEGIN;

-- 1. Create dutch_auctions table
CREATE TABLE IF NOT EXISTS public.dutch_auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    ticket_tier_id UUID NOT NULL REFERENCES public.ticket_tiers(id) ON DELETE CASCADE,
    start_price_cents INTEGER NOT NULL DEFAULT 5000, -- $50.00
    min_price_cents INTEGER NOT NULL DEFAULT 1000, -- $10.00
    price_drop_interval_seconds INTEGER NOT NULL DEFAULT 60, -- 60s drops
    price_drop_amount_cents INTEGER NOT NULL DEFAULT 100, -- $1.00 drop
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_dutch_auction_prices CHECK (start_price_cents >= min_price_cents),
    CONSTRAINT check_dutch_auction_intervals CHECK (price_drop_interval_seconds > 0 AND price_drop_amount_cents > 0),
    CONSTRAINT check_dutch_auction_timeline CHECK (ends_at >= starts_at)
);

-- 2. Create dutch_auction_purchases table
CREATE TABLE IF NOT EXISTS public.dutch_auction_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES public.dutch_auctions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    price_paid_cents INTEGER NOT NULL,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexing for fast dynamic evaluations
CREATE INDEX IF NOT EXISTS idx_dutch_auctions_event ON public.dutch_auctions(event_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_dutch_auction_purchases_auction ON public.dutch_auction_purchases(auction_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.dutch_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dutch_auction_purchases ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "Allow public read access to active Dutch auctions"
ON public.dutch_auctions FOR SELECT USING (true);

CREATE POLICY "Allow public read access to purchases"
ON public.dutch_auction_purchases FOR SELECT USING (true);

CREATE POLICY "Admins can manage Dutch auctions"
ON public.dutch_auctions FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
);

CREATE POLICY "Admins can manage purchases"
ON public.dutch_auction_purchases FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'system_admin'
    )
);

-- 6. Dutch Auction helper function to calculate ticking price
CREATE OR REPLACE FUNCTION public.get_dutch_auction_current_price(
    p_auction_id UUID,
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auction RECORD;
    v_elapsed INTEGER;
    v_intervals INTEGER;
    v_current_price INTEGER;
BEGIN
    SELECT * INTO v_auction FROM public.dutch_auctions WHERE id = p_auction_id;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    IF p_now < v_auction.starts_at THEN
        RETURN v_auction.start_price_cents;
    END IF;

    IF p_now >= v_auction.ends_at THEN
        RETURN v_auction.min_price_cents;
    END IF;

    v_elapsed := EXTRACT(EPOCH FROM (p_now - v_auction.starts_at))::INTEGER;
    v_intervals := FLOOR(v_elapsed::NUMERIC / v_auction.price_drop_interval_seconds::NUMERIC)::INTEGER;
    v_current_price := v_auction.start_price_cents - (v_intervals * v_auction.price_drop_amount_cents);

    RETURN GREATEST(v_current_price, v_auction.min_price_cents);
END;
$$;

-- 7. High-frequency transactional buy ticket RPC
CREATE OR REPLACE FUNCTION public.purchase_dutch_auction_ticket(
    p_auction_id UUID,
    p_user_id UUID,
    p_max_price_cents INTEGER,
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auction RECORD;
    v_tier RECORD;
    v_current_price INTEGER;
    v_sold_count INTEGER;
    v_new_rsvp_id UUID;
    v_purchase_id UUID;
BEGIN
    -- Acquire exclusive lock on the auction to prevent price discrepancies
    SELECT * INTO v_auction FROM public.dutch_auctions WHERE id = p_auction_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Auction not found.');
    END IF;

    IF NOT v_auction.is_active THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Auction is inactive.');
    END IF;

    IF p_now < v_auction.starts_at THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Auction has not started yet.');
    END IF;

    IF p_now > v_auction.ends_at THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Auction has expired.');
    END IF;

    -- Calculate active dynamic price
    v_current_price := public.get_dutch_auction_current_price(p_auction_id, p_now);

    -- Enforce slippage check
    IF v_current_price > p_max_price_cents THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Price updated to ' || v_current_price::TEXT || ' cents, exceeding user limit of ' || p_max_price_cents::TEXT || ' cents.'
        );
    END IF;

    -- Lock the associated ticket tier to serialize capacity checkout
    SELECT * INTO v_tier FROM public.ticket_tiers WHERE id = v_auction.ticket_tier_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Ticket tier configuration missing.');
    END IF;

    -- Verify tickets remaining
    SELECT COUNT(*)::INTEGER INTO v_sold_count
    FROM public.event_rsvps
    WHERE ticket_tier_id = v_auction.ticket_tier_id AND status = 'approved';

    IF v_sold_count >= v_tier.capacity THEN
        UPDATE public.dutch_auctions SET is_active = FALSE WHERE id = p_auction_id;
        RETURN jsonb_build_object('success', FALSE, 'error', 'Tickets are sold out.');
    END IF;

    -- Insert approved RSVP entry
    INSERT INTO public.event_rsvps (event_id, user_id, status, ticket_tier_id, checked_in)
    VALUES (v_auction.event_id, p_user_id, 'approved', v_auction.ticket_tier_id, FALSE)
    RETURNING id INTO v_new_rsvp_id;

    -- Insert auction purchase log
    INSERT INTO public.dutch_auction_purchases (auction_id, user_id, price_paid_cents, purchased_at)
    VALUES (p_auction_id, p_user_id, v_current_price, p_now)
    RETURNING id INTO v_purchase_id;

    -- Disable auction if last ticket was purchased
    IF (v_sold_count + 1) >= v_tier.capacity THEN
        UPDATE public.dutch_auctions SET is_active = FALSE WHERE id = p_auction_id;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'approved',
        'rsvp_id', v_new_rsvp_id,
        'purchase_id', v_purchase_id,
        'price_paid_cents', v_current_price,
        'remaining_capacity', v_tier.capacity - (v_sold_count + 1)
    );
END;
$$;

-- 8. Add table to supabase realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.dutch_auctions;

COMMIT;
