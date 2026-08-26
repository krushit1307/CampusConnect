-- Migration: 20260815200000_silent_auction_bidding.sql
-- Description: Create auction_items, auction_bids, and auction_winners tables,
--               row-locked place_silent_auction_bid RPC with anti-sniping 5-minute timer extension,
--               and close_silent_auction RPC (#3021).

-- 1. Create auction_items table
CREATE TABLE IF NOT EXISTS public.auction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    starting_bid INT NOT NULL DEFAULT 100, -- Amount in cents or dollars
    current_highest_bid INT NOT NULL DEFAULT 0,
    highest_bidder_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create auction_bids table
CREATE TABLE IF NOT EXISTS public.auction_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.auction_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    bid_amount INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create auction_winners table
CREATE TABLE IF NOT EXISTS public.auction_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.auction_items(id) ON DELETE CASCADE,
    winner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    winning_bid INT NOT NULL,
    stripe_checkout_url TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending', -- pending, paid
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (item_id)
);

-- Enable RLS
ALTER TABLE public.auction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_winners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active auction items" ON public.auction_items FOR SELECT USING (TRUE);
CREATE POLICY "Authenticated users can view auction bids" ON public.auction_bids FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Winners can view their winning records" ON public.auction_winners FOR SELECT USING (auth.uid() = winner_user_id OR auth.role() = 'authenticated');

-- 4. Row-Locked Transactional Bidding RPC Function with Anti-Sniping Protection
CREATE OR REPLACE FUNCTION public.place_silent_auction_bid(
    p_item_id UUID,
    p_user_id UUID,
    p_bid_amount INT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_highest_bid INT,
    new_end_time TIMESTAMPTZ,
    extended_by_anti_sniping BOOLEAN
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_prev_bidder_id UUID;
    v_extended BOOLEAN := FALSE;
    v_new_end_time TIMESTAMPTZ;
BEGIN
    -- Strict Row-Level Lock on auction_items (FOR UPDATE) to prevent race conditions
    SELECT * INTO v_item
    FROM public.auction_items
    WHERE id = p_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Auction item not found.', 0, NOW(), FALSE;
        RETURN;
    END IF;

    IF v_item.is_closed OR NOW() >= v_item.end_time THEN
        RETURN QUERY SELECT FALSE, 'Auction for this item has closed.', v_item.current_highest_bid, v_item.end_time, FALSE;
        RETURN;
    END IF;

    -- Validate bid amount
    IF p_bid_amount <= v_item.current_highest_bid THEN
        RETURN QUERY SELECT FALSE, 'Your bid must be higher than the current highest bid.', v_item.current_highest_bid, v_item.end_time, FALSE;
        RETURN;
    END IF;

    IF p_bid_amount < v_item.starting_bid THEN
        RETURN QUERY SELECT FALSE, 'Your bid must meet or exceed the starting bid.', v_item.current_highest_bid, v_item.end_time, FALSE;
        RETURN;
    END IF;

    v_prev_bidder_id := v_item.highest_bidder_id;
    v_new_end_time := v_item.end_time;

    -- Anti-Sniping Logic: If bid placed in the final 2 minutes (120s), automatically extend end_time by 5 minutes
    IF v_item.end_time - NOW() <= INTERVAL '2 minutes' THEN
        v_new_end_time := NOW() + INTERVAL '5 minutes';
        v_extended := TRUE;
    END IF;

    -- Insert bid record
    INSERT INTO public.auction_bids (item_id, user_id, bid_amount)
    VALUES (p_item_id, p_user_id, p_bid_amount);

    -- Update auction item state
    UPDATE public.auction_items
    SET current_highest_bid = p_bid_amount,
        highest_bidder_id = p_user_id,
        end_time = v_new_end_time
    WHERE id = p_item_id;

    -- Trigger instant Push Notification to previous highest bidder if outbid
    IF v_prev_bidder_id IS NOT NULL AND v_prev_bidder_id <> p_user_id THEN
        INSERT INTO public.notifications (user_id, title, content, type)
        VALUES (
            v_prev_bidder_id,
            'Outbid Alert!',
            'You have been outbid on ' || v_item.title || '. Tap to place a higher bid!',
            'outbid_alert'
        );
    END IF;

    RETURN QUERY SELECT TRUE, 'Bid placed successfully!', p_bid_amount, v_new_end_time, v_extended;
END;
$$;

-- 5. RPC Function to Close Auction Item and Record Winner
CREATE OR REPLACE FUNCTION public.close_silent_auction(p_item_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    winner_id UUID,
    winning_bid INT,
    message TEXT
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
BEGIN
    SELECT * INTO v_item FROM public.auction_items WHERE id = p_item_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, 'Auction item not found.';
        RETURN;
    END IF;

    IF v_item.is_closed THEN
        RETURN QUERY SELECT FALSE, v_item.highest_bidder_id, v_item.current_highest_bid, 'Auction is already closed.';
        RETURN;
    END IF;

    -- Mark item as closed
    UPDATE public.auction_items SET is_closed = TRUE WHERE id = p_item_id;

    IF v_item.highest_bidder_id IS NOT NULL THEN
        INSERT INTO public.auction_winners (
            item_id,
            winner_user_id,
            winning_bid,
            payment_status
        )
        VALUES (
            p_item_id,
            v_item.highest_bidder_id,
            v_item.current_highest_bid,
            'pending'
        )
        ON CONFLICT (item_id) DO NOTHING;

        RETURN QUERY SELECT TRUE, v_item.highest_bidder_id, v_item.current_highest_bid, 'Auction closed and winner recorded!';
    ELSE
        RETURN QUERY SELECT TRUE, NULL::UUID, 0, 'Auction closed with no bids placed.';
    END IF;
END;
$$;
