-- Migration: 20261016000000_interactive_lost_found_map_pinning.sql
-- Description: Add columns for GPS coordinates (lat, lng) and floor details, and update creation RPC.

-- 1. Schema updates on lost_found_items
ALTER TABLE public.lost_found_items ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.lost_found_items ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE public.lost_found_items ADD COLUMN IF NOT EXISTS floor_details TEXT;

-- 2. Index for coordinate queries
CREATE INDEX IF NOT EXISTS idx_lost_found_items_coords 
ON public.lost_found_items (lat, lng) 
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- 3. Redefine create_lost_item_with_bounty to support map pinning
CREATE OR REPLACE FUNCTION public.create_lost_item_with_bounty(
    p_type TEXT,
    p_title TEXT,
    p_description TEXT,
    p_category TEXT,
    p_location TEXT,
    p_contact_info TEXT,
    p_bounty_amount INTEGER,
    p_image_url TEXT DEFAULT NULL,
    p_lat DOUBLE PRECISION DEFAULT NULL,
    p_lng DOUBLE PRECISION DEFAULT NULL,
    p_floor_details TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_item_id UUID;
    v_current_balance INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_bounty_amount < 0 THEN
        RAISE EXCEPTION 'Bounty amount must be positive';
    END IF;

    IF p_bounty_amount > 0 THEN
        -- Lock wallet
        SELECT balance INTO v_current_balance
        FROM public.user_wallets
        WHERE user_id = v_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Wallet not found';
        END IF;

        IF v_current_balance < p_bounty_amount THEN
            RAISE EXCEPTION 'Insufficient funds for bounty';
        END IF;
    END IF;

    -- Create Item with map pinning details
    INSERT INTO public.lost_found_items (
        user_id, type, title, description, category, location, contact_info, image_url, bounty_amount, lat, lng, floor_details
    ) VALUES (
        v_user_id, p_type, p_title, p_description, p_category, p_location, p_contact_info, p_image_url, p_bounty_amount, p_lat, p_lng, p_floor_details
    ) RETURNING id INTO v_item_id;

    -- Handle Bounty
    IF p_bounty_amount > 0 THEN
        -- Debit wallet
        UPDATE public.user_wallets
        SET balance = balance - p_bounty_amount,
            lifetime_spent = lifetime_spent + p_bounty_amount,
            updated_at = NOW()
        WHERE user_id = v_user_id;

        -- Create escrow
        INSERT INTO public.lost_item_bounties (lost_item_id, owner_id, amount, status)
        VALUES (v_item_id, v_user_id, p_bounty_amount, 'escrow');

        -- Create ledger transaction
        INSERT INTO public.wallet_transactions (user_id, amount, balance_after, transaction_type, description, reference_id)
        VALUES (v_user_id, -p_bounty_amount, v_current_balance - p_bounty_amount, 'purchase', 'Placed bounty in escrow for lost item', v_item_id);
    END IF;

    RETURN v_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
