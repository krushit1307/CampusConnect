-- Migration: Lost & Found Bounty System
-- Issue: #2865 - Integrate Gamification Wallet with Lost & Found

-- 1. Add bounty_amount to lost_found_items
ALTER TABLE public.lost_found_items 
ADD COLUMN bounty_amount INTEGER NOT NULL DEFAULT 0 CHECK (bounty_amount >= 0);

-- 2. Create Escrow Table (lost_item_bounties)
CREATE TABLE IF NOT EXISTS public.lost_item_bounties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lost_item_id UUID NOT NULL REFERENCES public.lost_found_items(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id),
    amount INTEGER NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'escrow' CHECK (status IN ('escrow', 'released', 'refunded')),
    finder_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 days'),
    released_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    CONSTRAINT one_bounty_per_item UNIQUE (lost_item_id)
);

CREATE INDEX IF NOT EXISTS idx_lost_item_bounties_status_expires ON public.lost_item_bounties(status, expires_at);

-- 3. Create Claims Table (lost_item_claims)
CREATE TABLE IF NOT EXISTS public.lost_item_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lost_item_id UUID NOT NULL REFERENCES public.lost_found_items(id) ON DELETE CASCADE,
    finder_id UUID NOT NULL REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'verified', 'cancelled')),
    verification_nonce TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lost_item_claims_item ON public.lost_item_claims(lost_item_id, status);

-- Enable RLS
ALTER TABLE public.lost_item_bounties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_item_claims ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Bounties: Anyone can read active/resolved bounties
CREATE POLICY "Anyone can view bounties" ON public.lost_item_bounties FOR SELECT USING (true);
CREATE POLICY "System only bounty inserts" ON public.lost_item_bounties FOR INSERT WITH CHECK (FALSE);
CREATE POLICY "System only bounty updates" ON public.lost_item_bounties FOR UPDATE USING (FALSE);

-- Claims: Finder can view their claims, Owner can view claims on their items
CREATE POLICY "Finders can view own claims" ON public.lost_item_claims FOR SELECT USING (auth.uid() = finder_id);
CREATE POLICY "Owners can view claims on their items" ON public.lost_item_claims FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lost_found_items WHERE id = lost_item_claims.lost_item_id AND user_id = auth.uid())
);
-- Allow finder to insert a claim
CREATE POLICY "Finder can insert claim" ON public.lost_item_claims FOR INSERT WITH CHECK (auth.uid() = finder_id AND status = 'pending');
-- Allow finder to cancel their claim
CREATE POLICY "Finder can update own claim" ON public.lost_item_claims FOR UPDATE USING (auth.uid() = finder_id) WITH CHECK (status IN ('cancelled'));

-- 5. RPC Functions

-- A. create_lost_item_with_bounty
CREATE OR REPLACE FUNCTION public.create_lost_item_with_bounty(
    p_type TEXT,
    p_title TEXT,
    p_description TEXT,
    p_category TEXT,
    p_location TEXT,
    p_contact_info TEXT,
    p_bounty_amount INTEGER,
    p_image_url TEXT DEFAULT NULL
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

    -- Create Item
    INSERT INTO public.lost_found_items (
        user_id, type, title, description, category, location, contact_info, image_url, bounty_amount
    ) VALUES (
        v_user_id, p_type, p_title, p_description, p_category, p_location, p_contact_info, p_image_url, p_bounty_amount
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

-- B. accept_lost_item_claim
CREATE OR REPLACE FUNCTION public.accept_lost_item_claim(
    p_claim_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_item_id UUID;
    v_nonce TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify owner
    SELECT lost_item_id INTO v_item_id
    FROM public.lost_item_claims
    JOIN public.lost_found_items ON lost_found_items.id = lost_item_claims.lost_item_id
    WHERE lost_item_claims.id = p_claim_id AND lost_found_items.user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found or you are not the owner';
    END IF;

    -- Ensure no other claim is accepted for this item
    IF EXISTS (
        SELECT 1 FROM public.lost_item_claims
        WHERE lost_item_id = v_item_id AND status = 'accepted'
    ) THEN
        RAISE EXCEPTION 'Another claim is already accepted for this item';
    END IF;

    -- Generate nonce
    v_nonce := gen_random_uuid()::TEXT;

    -- Update claim
    UPDATE public.lost_item_claims
    SET status = 'accepted', verification_nonce = v_nonce
    WHERE id = p_claim_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim cannot be accepted';
    END IF;

    RETURN v_nonce;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. reject_lost_item_claim
CREATE OR REPLACE FUNCTION public.reject_lost_item_claim(
    p_claim_id UUID
) RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.lost_item_claims
    SET status = 'rejected'
    FROM public.lost_found_items
    WHERE lost_item_claims.lost_item_id = lost_found_items.id
      AND lost_item_claims.id = p_claim_id
      AND lost_found_items.user_id = v_user_id
      AND lost_item_claims.status IN ('pending', 'accepted');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found, or cannot be rejected';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- D. verify_lost_item_return
CREATE OR REPLACE FUNCTION public.verify_lost_item_return(
    p_claim_id UUID,
    p_nonce TEXT
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_bounty RECORD;
    v_claim RECORD;
    v_finder_balance INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify claim and nonce, and ensure caller is the item owner
    SELECT c.* INTO v_claim
    FROM public.lost_item_claims c
    JOIN public.lost_found_items i ON i.id = c.lost_item_id
    WHERE c.id = p_claim_id 
      AND c.verification_nonce = p_nonce 
      AND c.status = 'accepted'
      AND i.user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid claim, invalid nonce, or you are not the owner';
    END IF;

    -- Check if bounty exists, lock it
    SELECT * INTO v_bounty
    FROM public.lost_item_bounties
    WHERE lost_item_id = v_claim.lost_item_id AND status = 'escrow'
    FOR UPDATE;

    IF FOUND THEN
        -- Release bounty to finder
        
        -- Lock finder wallet
        SELECT balance INTO v_finder_balance
        FROM public.user_wallets
        WHERE user_id = v_claim.finder_id
        FOR UPDATE;

        IF NOT FOUND THEN
            -- Create wallet for finder if they don't have one
            INSERT INTO public.user_wallets (user_id, balance) VALUES (v_claim.finder_id, 0) RETURNING balance INTO v_finder_balance;
        END IF;

        -- Update finder wallet
        UPDATE public.user_wallets
        SET balance = balance + v_bounty.amount,
            lifetime_earned = lifetime_earned + v_bounty.amount,
            updated_at = NOW()
        WHERE user_id = v_claim.finder_id;

        -- Ledger transaction
        INSERT INTO public.wallet_transactions (user_id, amount, balance_after, transaction_type, description, reference_id)
        VALUES (v_claim.finder_id, v_bounty.amount, v_finder_balance + v_bounty.amount, 'earn', 'Bounty rewarded for finding lost item', v_claim.lost_item_id);

        -- Update bounty status
        UPDATE public.lost_item_bounties
        SET status = 'released', finder_id = v_claim.finder_id, released_at = NOW()
        WHERE id = v_bounty.id;
    END IF;

    -- Mark claim as verified
    UPDATE public.lost_item_claims
    SET status = 'verified', verified_at = NOW(), verification_nonce = NULL
    WHERE id = p_claim_id;

    -- Mark item as resolved
    UPDATE public.lost_found_items
    SET status = 'resolved'
    WHERE id = v_claim.lost_item_id;

    RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- E. refund_expired_bounties (Called via pg_cron)
CREATE OR REPLACE FUNCTION public.refund_expired_bounties() RETURNS VOID AS $$
DECLARE
    v_bounty RECORD;
    v_owner_balance INTEGER;
BEGIN
    FOR v_bounty IN 
        SELECT * FROM public.lost_item_bounties 
        WHERE status = 'escrow' AND expires_at <= NOW() 
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Lock owner wallet
        SELECT balance INTO v_owner_balance
        FROM public.user_wallets
        WHERE user_id = v_bounty.owner_id
        FOR UPDATE;

        IF FOUND THEN
            -- Refund
            UPDATE public.user_wallets
            SET balance = balance + v_bounty.amount,
                updated_at = NOW()
            WHERE user_id = v_bounty.owner_id;

            -- Ledger transaction
            INSERT INTO public.wallet_transactions (user_id, amount, balance_after, transaction_type, description, reference_id)
            VALUES (v_bounty.owner_id, v_bounty.amount, v_owner_balance + v_bounty.amount, 'refund', 'Refunded expired lost item bounty', v_bounty.lost_item_id);

            -- Update bounty
            UPDATE public.lost_item_bounties
            SET status = 'refunded', refunded_at = NOW()
            WHERE id = v_bounty.id;
            
            -- Keep the item active, just refund the bounty
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. pg_cron schedule for refunds
-- Runs every day at midnight (conditionally if pg_cron is enabled, otherwise fail silently or comment out)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule('refund_lost_item_bounties', '0 0 * * *', 'SELECT public.refund_expired_bounties();');
    END IF;
END $$;
