-- Migration: 20261120000000_automated_vendor_payment_splitting.sql
-- Description: Issue #3438 - Automated Vendor Payment Splitting System
-- Sets up stripe_account_id, payouts_enabled and profit_share_pct.

-- 1. Add Stripe Connect columns to event_vendors table
ALTER TABLE public.event_vendors
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS payouts_enabled BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS profit_share_pct NUMERIC(5,2) DEFAULT 0.00 NOT NULL CHECK (profit_share_pct >= 0 AND profit_share_pct <= 100);

-- 2. Create the scan-and-pay execution function (Postgres atomic transaction)
CREATE OR REPLACE FUNCTION public.process_vendor_wallet_payment(
    p_user_id UUID,
    p_vendor_id UUID,
    p_amount_cents INT,
    p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_vendor RECORD;
    v_fee_cents INT;
    v_vendor_payout_cents INT;
    v_new_balance INT;
    v_tx_id UUID;
BEGIN
    -- 1. Lock user's wallet
    SELECT * INTO v_wallet
    FROM public.user_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Auto-initialize wallet for first time users if missing
        INSERT INTO public.user_wallets (user_id, balance)
        VALUES (p_user_id, 0)
        RETURNING * INTO v_wallet;
    END IF;

    -- Check balance
    IF v_wallet.balance < p_amount_cents THEN
        RAISE EXCEPTION 'Insufficient wallet balance. Required: %, Available: %', p_amount_cents, v_wallet.balance;
    END IF;

    -- 2. Fetch and lock vendor onboarding and share configuration
    SELECT * INTO v_vendor
    FROM public.event_vendors
    WHERE id = p_vendor_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vendor % not found', p_vendor_id;
    END IF;

    IF v_vendor.approval_status <> 'APPROVED' THEN
        RAISE EXCEPTION 'Vendor is not approved';
    END IF;

    -- Check if Stripe Connect is properly linked
    IF v_vendor.stripe_account_id IS NULL OR NOT v_vendor.payouts_enabled THEN
        RAISE EXCEPTION 'Vendor is not configured for Stripe payouts';
    END IF;

    -- Calculate profit share splits
    -- Profit share goes to the host/platform, vendor gets the remaining
    v_fee_cents := ROUND(p_amount_cents * (v_vendor.profit_share_pct / 100.0));
    v_vendor_payout_cents := p_amount_cents - v_fee_cents;

    -- 3. Deduct from wallet
    v_new_balance := v_wallet.balance - p_amount_cents;
    UPDATE public.user_wallets
    SET balance = v_new_balance,
        lifetime_spent = lifetime_spent + p_amount_cents,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- 4. Generate transaction ID
    v_tx_id := gen_random_uuid();

    -- 5. Record wallet transaction
    INSERT INTO public.wallet_transactions (
        id,
        user_id,
        amount,
        balance_after,
        transaction_type,
        description,
        reference_id
    ) VALUES (
        v_tx_id,
        p_user_id,
        -p_amount_cents,
        v_new_balance,
        'purchase',
        p_description,
        p_vendor_id
    );

    -- Return JSON payload detailing the transaction splits for the edge function to process Stripe transfer
    RETURN JSONB_BUILD_OBJECT(
        'success', TRUE,
        'transaction_id', v_tx_id,
        'amount_cents', p_amount_cents,
        'vendor_payout_cents', v_vendor_payout_cents,
        'fee_cents', v_fee_cents,
        'stripe_account_id', v_vendor.stripe_account_id,
        'new_balance', v_new_balance
    );
END;
$$;
