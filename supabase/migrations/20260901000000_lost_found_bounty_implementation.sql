-- Migration: Lost & Found Bounty System with Stripe Integration
-- Issue: #2865 - Implement Interactive Lost Item Bounty System

-- 1. Update lost_found_items table
ALTER TABLE public.lost_found_items
ADD COLUMN IF NOT EXISTS bounty_amount INTEGER NOT NULL DEFAULT 0 CHECK (bounty_amount >= 0),
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- 2. Create lost_item_bounties table
CREATE TABLE IF NOT EXISTS public.lost_item_bounties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lost_item_id UUID NOT NULL REFERENCES public.lost_found_items(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id),
    amount INTEGER NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'escrow' CHECK (status IN ('escrow', 'released', 'refunded', 'disputed')),
    finder_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 days'),
    released_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    dispute_reason TEXT,
    dispute_resolved BOOLEAN DEFAULT FALSE,
    CONSTRAINT one_bounty_per_item UNIQUE (lost_item_id)
);

CREATE INDEX IF NOT EXISTS idx_lost_item_bounties_status_expires ON public.lost_item_bounties(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_lost_item_bounties_finder ON public.lost_item_bounties(finder_id);

-- 3. Create lost_item_claims table
CREATE TABLE IF NOT EXISTS public.lost_item_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lost_item_id UUID NOT NULL REFERENCES public.lost_found_items(id) ON DELETE CASCADE,
    finder_id UUID NOT NULL REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'verified', 'cancelled', 'disputed')),
    verification_nonce TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    dispute_reason TEXT,
    evidence_url TEXT,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lost_item_claims_item ON public.lost_item_claims(lost_item_id, status);
CREATE INDEX IF NOT EXISTS idx_lost_item_claims_finder ON public.lost_item_claims(finder_id);

-- 4. Enable RLS for new tables
ALTER TABLE public.lost_item_bounties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_item_claims ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Bounties: Anyone can read active bounties, owners can manage their own
CREATE POLICY "Anyone can view bounties" ON public.lost_item_bounties FOR SELECT USING (true);
CREATE POLICY "Owners can manage their bounties" ON public.lost_item_bounties FOR ALL USING (owner_id = auth.uid());

-- Claims: Finder can view/manage their claims, Owners can view claims on their items
CREATE POLICY "Finders can view/manage own claims" ON public.lost_item_claims FOR ALL USING (auth.uid() = finder_id);
CREATE POLICY "Owners can view claims on their items" ON public.lost_item_claims FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lost_found_items WHERE id = lost_item_claims.lost_item_id AND user_id = auth.uid())
);

-- 6. RPC Functions

-- A. create_lost_item_with_bounty (updated)
CREATE OR REPLACE FUNCTION public.create_lost_item_with_bounty(
    p_type TEXT,
    p_title TEXT,
    p_description TEXT,
    p_category TEXT,
    p_location TEXT,
    p_contact_info TEXT,
    p_bounty_amount INTEGER,
    p_image_url TEXT DEFAULT NULL,
    p_stripe_payment_intent_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_item_id UUID;
    v_current_balance INTEGER;
    v_stripe_intent TEXT;
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

        -- Create Stripe PaymentIntent if not provided
        IF p_stripe_payment_intent_id IS NULL OR p_stripe_payment_intent_id = '' THEN
            -- In real implementation, this would call Stripe API
            v_stripe_intent := 'pi_' || gen_random_uuid()::TEXT;
        ELSE
            v_stripe_intent := p_stripe_payment_intent_id;
        END IF;
    END IF;

    -- Create Item
    INSERT INTO public.lost_found_items (
        user_id, type, title, description, category, location,
        contact_info, image_url, bounty_amount, stripe_payment_intent_id
    ) VALUES (
        v_user_id, p_type, p_title, p_description, p_category, p_location,
        p_contact_info, p_image_url, p_bounty_amount, v_stripe_intent
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

-- B. release_bounty_to_finder
CREATE OR REPLACE FUNCTION public.release_bounty_to_finder(
    p_claim_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_item_id UUID;
    v_bounty_id UUID;
    v_amount INTEGER;
    v_finder_id UUID;
    v_stripe_intent TEXT;
BEGIN
    -- Verify owner
    SELECT lfc.lost_item_id, lib.id, lib.amount, lfc.stripe_payment_intent_id, lfc.user_id
    INTO v_item_id, v_bounty_id, v_amount, v_stripe_intent, v_user_id
    FROM public.lost_item_claims lic
    JOIN public.lost_item_bounties lib ON lib.lost_item_id = lic.lost_item_id
    JOIN public.lost_found_items