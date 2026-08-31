-- ============================================================
-- Migration: 20260829000002_vickrey_auction.sql
-- Issue: #5056 - Dynamic "Resource Constraint" Auction Bid-Shielding Algorithm
-- Description:
--   1. Create resource_auctions table for sealed-bid second-price auctions
--   2. Create auction_bids table for hidden maximum bids
--   3. Create RPC functions for bid submission and auction settlement
--   4. Create cron job for 24-hour auction end
--   5. Implement Vickrey pricing (second-highest bid + 1)
-- ============================================================

SET lock_timeout = '3s';

-- 1. Create resource_auctions table
CREATE TABLE IF NOT EXISTS public.resource_auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ NOT NULL,
    minimum_bid INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'settled', 'cancelled')),
    winner_club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
    winning_bid INT,
    final_price INT,
    settlement_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_end_time_after_start CHECK (end_time > start_time),
    CONSTRAINT chk_minimum_bid_positive CHECK (minimum_bid >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_resource_auctions_item_id ON public.resource_auctions(item_id);
CREATE INDEX IF NOT EXISTS idx_resource_auctions_status ON public.resource_auctions(status);
CREATE INDEX IF NOT EXISTS idx_resource_auctions_end_time ON public.resource_auctions(end_time);
CREATE INDEX IF NOT EXISTS idx_resource_auctions_winner ON public.resource_auctions(winner_club_id);

-- 2. Create auction_bids table (sealed bids)
CREATE TABLE IF NOT EXISTS public.auction_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES public.resource_auctions(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    bidder_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    maximum_bid INT NOT NULL,
    bid_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_winning_bid BOOLEAN DEFAULT FALSE,
    is_revealed BOOLEAN DEFAULT FALSE, -- Whether bid has been revealed (after auction ends)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_maximum_bid_positive CHECK (maximum_bid >= 0),
    CONSTRAINT chk_unique_bid_per_club UNIQUE (auction_id, club_id),
    CONSTRAINT chk_bid_above_minimum CHECK (maximum_bid >= (SELECT minimum_bid FROM public.resource_auctions WHERE id = auction_id))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auction_bids_auction_id ON public.auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_club_id ON public.auction_bids(club_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder_id ON public.auction_bids(bidder_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_maximum_bid ON public.auction_bids(maximum_bid DESC);

-- 3. Enable RLS
ALTER TABLE public.resource_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

-- Policies for resource_auctions
CREATE POLICY "Authenticated users can view active auctions" ON public.resource_auctions
FOR SELECT TO authenticated
USING (status = 'active');

CREATE POLICY "Authenticated users can view settled auctions" ON public.resource_auctions
FOR SELECT TO authenticated
USING (status = 'settled');

CREATE POLICY "Admins can create auctions" ON public.resource_auctions
FOR INSERT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

CREATE POLICY "Admins can update auctions" ON public.resource_auctions
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policies for auction_bids
CREATE POLICY "Club members can view their own bids" ON public.auction_bids
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = auction_bids.club_id
          AND user_id = auth.uid()
          AND status = 'approved'
    )
);

CREATE POLICY "Winners can view winning bid after settlement" ON public.auction_bids
FOR SELECT TO authenticated
USING (
    is_revealed = TRUE
    OR EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = auction_bids.club_id
          AND user_id = auth.uid()
          AND status = 'approved'
    )
);

CREATE POLICY "Club admins can submit bids" ON public.auction_bids
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = auction_bids.club_id
          AND user_id = auth.uid()
          AND role = 'admin'
          AND status = 'approved'
    )
    AND EXISTS (
        SELECT 1 FROM public.resource_auctions
        WHERE id = auction_id
          AND status = 'active'
          AND end_time > NOW()
    )
);

CREATE POLICY "System can update bids" ON public.auction_bids
FOR UPDATE TO service_role
WITH CHECK (true);

-- 4. Create function to submit sealed bid
CREATE OR REPLACE FUNCTION public.submit_sealed_bid(
    p_auction_id UUID,
    p_club_id UUID,
    p_maximum_bid INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auction RECORD;
    v_existing_bid UUID;
    v_bid_id UUID;
BEGIN
    -- Lock auction record
    SELECT * INTO v_auction
    FROM public.resource_auctions
    WHERE id = p_auction_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Auction not found';
    END IF;
    
    -- Verify auction is active
    IF v_auction.status != 'active' THEN
        RAISE EXCEPTION 'Auction is not active';
    END IF;
    
    -- Verify auction hasn't ended
    IF v_auction.end_time <= NOW() THEN
        RAISE EXCEPTION 'Auction has ended';
    END IF;
    
    -- Verify bid meets minimum
    IF p_maximum_bid < v_auction.minimum_bid THEN
        RAISE EXCEPTION 'Bid must be at least the minimum bid';
    END IF;
    
    -- Check if club already has a bid
    SELECT id INTO v_existing_bid
    FROM public.auction_bids
    WHERE auction_id = p_auction_id AND club_id = p_club_id;
    
    IF v_existing_bid IS NOT NULL THEN
        -- Update existing bid
        UPDATE public.auction_bids
        SET 
            maximum_bid = p_maximum_bid,
            bid_timestamp = NOW(),
            is_winning_bid = FALSE
        WHERE id = v_existing_bid;
        
        RETURN v_existing_bid;
    ELSE
        -- Insert new bid
        INSERT INTO public.auction_bids (
            auction_id, club_id, bidder_id, maximum_bid
        ) VALUES (
            p_auction_id, p_club_id, auth.uid(), p_maximum_bid
        ) RETURNING id INTO v_bid_id;
        
        RETURN v_bid_id;
    END IF;
END;
$$;

-- 5. Create function to settle auction (Vickrey pricing)
CREATE OR REPLACE FUNCTION public.settle_auction(
    p_auction_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auction RECORD;
    v_all_bids RECORD;
    v_highest_bid INT;
    v_second_highest_bid INT;
    v_winner_club_id UUID;
    v_winner_bid_id UUID;
    v_final_price INT;
    v_result JSONB;
BEGIN
    -- Lock auction record
    SELECT * INTO v_auction
    FROM public.resource_auctions
    WHERE id = p_auction_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Auction not found';
    END IF;
    
    -- Verify auction is active
    IF v_auction.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction already settled');
    END IF;
    
    -- Verify auction has ended
    IF v_auction.end_time > NOW() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Auction has not ended yet');
    END IF;
    
    -- Get all bids, sorted by maximum bid descending
    FOR v_all_bids IN
        SELECT id, club_id, maximum_bid
        FROM public.auction_bids
        WHERE auction_id = p_auction_id
        ORDER BY maximum_bid DESC
    LOOP
        -- First iteration: highest bid
        IF v_highest_bid IS NULL THEN
            v_highest_bid := v_all_bids.maximum_bid;
            v_winner_club_id := v_all_bids.club_id;
            v_winner_bid_id := v_all_bids.id;
        -- Second iteration: second-highest bid
        ELSIF v_second_highest_bid IS NULL THEN
            v_second_highest_bid := v_all_bids.maximum_bid;
        END IF;
    END LOOP;
    
    -- If no bids, mark as settled with no winner
    IF v_highest_bid IS NULL THEN
        UPDATE public.resource_auctions
        SET 
            status = 'settled',
            settlement_timestamp = NOW(),
            updated_at = NOW()
        WHERE id = p_auction_id;
        
        RETURN jsonb_build_object('success', true, 'winner', NULL, 'final_price', 0, 'message', 'No bids received');
    END IF;
    
    -- Calculate final price (Vickrey: second-highest + 1, or minimum bid if only one bid)
    IF v_second_highest_bid IS NULL THEN
        v_final_price := v_auction.minimum_bid;
    ELSE
        v_final_price := v_second_highest_bid + 1;
    END IF;
    
    -- Ensure final price doesn't exceed winner's maximum bid
    IF v_final_price > v_highest_bid THEN
        v_final_price := v_highest_bid;
    END IF;
    
    -- Update auction with winner info
    UPDATE public.resource_auctions
    SET 
        status = 'settled',
        winner_club_id = v_winner_club_id,
        winning_bid = v_highest_bid,
        final_price = v_final_price,
        settlement_timestamp = NOW(),
        updated_at = NOW()
    WHERE id = p_auction_id;
    
    -- Mark winning bid
    UPDATE public.auction_bids
    SET is_winning_bid = TRUE
    WHERE id = v_winner_bid_id;
    
    -- Reveal all bids
    UPDATE public.auction_bids
    SET is_revealed = TRUE
    WHERE auction_id = p_auction_id;
    
    -- Create equipment reservation for winner
    INSERT INTO public.equipment_reservations (
        item_id, club_id, reserved_by, start_date, end_date, status, notes
    ) VALUES (
        v_auction.item_id,
        v_winner_club_id,
        (SELECT bidder_id FROM public.auction_bids WHERE id = v_winner_bid_id),
        NOW(),
        NOW() + INTERVAL '7 days', -- Default 7-day reservation
        'approved',
        'Won auction: ' || p_auction_id::text
    );
    
    -- Deduct points from winner club (placeholder for gamification system)
    -- TODO: Implement actual points deduction when gamification system is available
    
    RETURN jsonb_build_object(
        'success', true,
        'winner_club_id', v_winner_club_id,
        'winning_bid', v_highest_bid,
        'final_price', v_final_price,
        'message', 'Auction settled successfully'
    );
END;
$$;

-- 6. Create function to create resource auction
CREATE OR REPLACE FUNCTION public.create_resource_auction(
    p_item_id UUID,
    p_start_time TIMESTAMPTZ DEFAULT NOW(),
    p_duration_hours INT DEFAULT 24,
    p_minimum_bid INT DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_auction_id UUID;
    v_end_time TIMESTAMPTZ;
BEGIN
    -- Get item info
    SELECT * INTO v_item
    FROM public.inventory_items
    WHERE id = p_item_id AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found or not active';
    END IF;
    
    -- Calculate end time
    v_end_time := p_start_time + (p_duration_hours || ' hours')::INTERVAL;
    
    -- Create auction
    INSERT INTO public.resource_auctions (
        item_id,
        item_name,
        description,
        start_time,
        end_time,
        minimum_bid
    ) VALUES (
        p_item_id,
        v_item.name,
        'Auction for ' || v_item.name,
        p_start_time,
        v_end_time,
        p_minimum_bid
    ) RETURNING id INTO v_auction_id;
    
    RETURN v_auction_id;
END;
$$;

-- 7. Create function to get auctions needing settlement
CREATE OR REPLACE FUNCTION public.get_auctions_needing_settlement()
RETURNS TABLE (
    auction_id UUID,
    item_name TEXT,
    end_time TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ra.id,
        ra.item_name,
        ra.end_time
    FROM public.resource_auctions ra
    WHERE ra.status = 'active'
      AND ra.end_time <= NOW()
    ORDER BY ra.end_time ASC;
END;
$$;

-- 8. Create cron job to settle auctions
SELECT cron.schedule(
    'vickrey-auction-settler',
    '*/5 * * * *', -- Run every 5 minutes
    $$
    DO $$
    DECLARE
        v_auction RECORD;
        v_result JSONB;
    BEGIN
        FOR v_auction IN SELECT * FROM public.get_auctions_needing_settlement() LOOP
            -- Settle the auction
            SELECT public.settle_auction(v_auction.auction_id) INTO v_result;
            
            -- Log the settlement
            RAISE NOTICE 'Settled auction %: %', v_auction.auction_id, v_result;
        END LOOP;
    END $$;
    $$
);

-- 9. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.submit_sealed_bid(UUID, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_auction(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_resource_auction(UUID, TIMESTAMPTZ, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auctions_needing_settlement() TO service_role;
