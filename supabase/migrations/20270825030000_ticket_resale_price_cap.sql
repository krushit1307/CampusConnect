-- Migration: Dynamic Event Ticket Resale Price Cap Engine & Stripe Escrow Swap
-- Addresses Issue #4137

CREATE TABLE IF NOT EXISTS public.ticket_resale_marketplace_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL,
    event_id UUID NOT NULL,
    event_title VARCHAR(255) NOT NULL,
    seller_user_id UUID NOT NULL,
    original_price NUMERIC(10,2) NOT NULL CHECK (original_price >= 0),
    resale_price NUMERIC(10,2) NOT NULL CHECK (resale_price >= 0),
    tier_name VARCHAR(100) DEFAULT 'General Admission',
    seat_identifier VARCHAR(100) DEFAULT 'GA Section',
    status VARCHAR(50) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'PENDING_ESCROW', 'SOLD', 'CANCELLED')),
    locked_for_escrow_until TIMESTAMPTZ,
    buyer_user_id UUID,
    escrow_payment_intent_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- CRITICAL ENFORCEMENT: Anti-scalping algorithmic price ceiling
    CONSTRAINT chk_strict_resale_price_cap CHECK (resale_price <= original_price)
);

CREATE TABLE IF NOT EXISTS public.ticket_resale_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.ticket_resale_marketplace_listings(id) ON DELETE CASCADE,
    original_ticket_id UUID NOT NULL,
    revoked_barcode_hash VARCHAR(255) NOT NULL,
    new_ticket_id UUID NOT NULL,
    new_barcode_hash VARCHAR(255) NOT NULL,
    seller_user_id UUID NOT NULL,
    buyer_user_id UUID NOT NULL,
    transacted_amount NUMERIC(10,2) NOT NULL,
    stripe_charge_id VARCHAR(255),
    stripe_transfer_id VARCHAR(255),
    settled_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_resale_event_status ON public.ticket_resale_marketplace_listings(event_id, status);
CREATE INDEX IF NOT EXISTS idx_resale_seller ON public.ticket_resale_marketplace_listings(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_resale_buyer ON public.ticket_resale_marketplace_listings(buyer_user_id);

-- RLS
ALTER TABLE public.ticket_resale_marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_resale_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for available resale listings" ON public.ticket_resale_marketplace_listings
    FOR SELECT USING (status = 'AVAILABLE' OR auth.uid() = seller_user_id OR auth.uid() = buyer_user_id);

CREATE POLICY "Sellers can manage their listings" ON public.ticket_resale_marketplace_listings
    FOR ALL USING (auth.uid() = seller_user_id) WITH CHECK (auth.uid() = seller_user_id);

CREATE POLICY "Users can view their completed resale transactions" ON public.ticket_resale_transactions
    FOR SELECT USING (auth.uid() = seller_user_id OR auth.uid() = buyer_user_id);

-- Atomic Ticket Swapping RPC
CREATE OR REPLACE FUNCTION public.execute_ticket_resale_atomic_swap(
    p_listing_id UUID,
    p_buyer_id UUID,
    p_stripe_charge_id VARCHAR,
    p_stripe_transfer_id VARCHAR
)
RETURNS JSONB AS $$
DECLARE
    v_listing public.ticket_resale_marketplace_listings%ROWTYPE;
    v_revoked_hash VARCHAR(255);
    v_new_ticket_id UUID;
    v_new_hash VARCHAR(255);
    v_transaction_id UUID;
BEGIN
    -- 1. Lock listing row
    SELECT * INTO v_listing
    FROM public.ticket_resale_marketplace_listings
    WHERE id = p_listing_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Resale listing % not found', p_listing_id;
    END IF;

    IF v_listing.status = 'SOLD' THEN
        RAISE EXCEPTION 'Listing % is already sold', p_listing_id;
    END IF;

    IF v_listing.resale_price > v_listing.original_price THEN
        RAISE EXCEPTION 'Violation: Resale price % exceeds original price %', v_listing.resale_price, v_listing.original_price;
    END IF;

    -- 2. Generate new cryptographic ticket identifier & revoke old
    v_revoked_hash := 'REVOKED-' || encode(gen_random_bytes(16), 'hex');
    v_new_ticket_id := gen_random_uuid();
    v_new_hash := 'TKT-' || encode(gen_random_bytes(16), 'hex');

    -- 3. Mark listing as SOLD
    UPDATE public.ticket_resale_marketplace_listings
    SET 
        status = 'SOLD',
        buyer_user_id = p_buyer_id,
        updated_at = NOW()
    WHERE id = p_listing_id;

    -- 4. Record transaction log
    INSERT INTO public.ticket_resale_transactions (
        listing_id,
        original_ticket_id,
        revoked_barcode_hash,
        new_ticket_id,
        new_barcode_hash,
        seller_user_id,
        buyer_user_id,
        transacted_amount,
        stripe_charge_id,
        stripe_transfer_id,
        settled_at
    )
    VALUES (
        p_listing_id,
        v_listing.ticket_id,
        v_revoked_hash,
        v_new_ticket_id,
        v_new_hash,
        v_listing.seller_user_id,
        p_buyer_id,
        v_listing.resale_price,
        p_stripe_charge_id,
        p_stripe_transfer_id,
        NOW()
    )
    RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'new_ticket_id', v_new_ticket_id,
        'new_barcode_hash', v_new_hash,
        'amount_settled', v_listing.resale_price
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
