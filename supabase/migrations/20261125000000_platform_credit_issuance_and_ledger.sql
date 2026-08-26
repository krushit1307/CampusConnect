-- =============================================================================
-- Migration: User Platform Credit Balance, Internal Ledger, and Cancellation Claims
-- Issue: #4522 - Automated "Event Cancellation" Credit Issuance
-- Description: Establishes an internal user platform credit balance and ledger
-- (separate from club ledgers and gamification points), tracks event cancellation
-- refund claims with 10% bonus credit option, and provides atomic RPC functions
-- for credit issuance and checkout deduction.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. User Platform Balances (Materialized Balance in Cents)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_platform_balances (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance_cents INT NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
    lifetime_credited_cents INT NOT NULL DEFAULT 0 CHECK (lifetime_credited_cents >= 0),
    lifetime_spent_cents INT NOT NULL DEFAULT 0 CHECK (lifetime_spent_cents >= 0),
    bonus_earned_cents INT NOT NULL DEFAULT 0 CHECK (bonus_earned_cents >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_platform_balances_balance 
ON public.user_platform_balances(user_id, balance_cents);

-- =============================================================================
-- 2. User Platform Credit Ledger (Immutable Audit Trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_platform_credit_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_cents INT NOT NULL, -- Positive for credits, negative for debits
    balance_after_cents INT NOT NULL CHECK (balance_after_cents >= 0),
    transaction_type TEXT NOT NULL CHECK (
        transaction_type IN ('cancellation_credit', 'checkout_deduction', 'refund_payout', 'admin_adjustment', 'credit_bonus')
    ),
    description TEXT NOT NULL,
    reference_id TEXT, -- e.g. event_id, claim_id, order_id, rsvp_id
    bonus_amount_cents INT NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_platform_credit_ledger_user 
ON public.user_platform_credit_ledger(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_platform_credit_ledger_ref 
ON public.user_platform_credit_ledger(reference_id);

-- =============================================================================
-- 3. Cancellation Refund Claims (Event Cancellation Choices)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cancellation_refund_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_amount_cents INT NOT NULL CHECK (original_amount_cents > 0),
    bonus_percentage NUMERIC NOT NULL DEFAULT 10 CHECK (bonus_percentage >= 0),
    credit_amount_cents INT NOT NULL CHECK (credit_amount_cents >= original_amount_cents),
    status TEXT NOT NULL DEFAULT 'pending_choice' CHECK (
        status IN ('pending_choice', 'credit_issued', 'card_refunded', 'expired')
    ),
    selected_option TEXT CHECK (selected_option IN ('card', 'credit')),
    stripe_refund_id TEXT,
    expires_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cancellation_claim_rsvp UNIQUE (rsvp_id)
);

CREATE INDEX IF NOT EXISTS idx_cancellation_claims_user 
ON public.cancellation_refund_claims(user_id, status);

CREATE INDEX IF NOT EXISTS idx_cancellation_claims_event 
ON public.cancellation_refund_claims(event_id);

-- =============================================================================
-- 4. Atomic RPC: Process Cancellation Refund Choice
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_cancellation_refund_choice(
    p_claim_id UUID,
    p_user_id UUID,
    p_choice TEXT
) RETURNS JSONB AS $$
DECLARE
    v_claim RECORD;
    v_current_balance INT := 0;
    v_new_balance INT := 0;
    v_bonus_cents INT := 0;
BEGIN
    -- 1. Validate choice
    IF p_choice NOT IN ('card', 'credit') THEN
        RAISE EXCEPTION 'Invalid choice: must be card or credit';
    END IF;

    -- 2. Lock and fetch claim row
    SELECT * INTO v_claim
    FROM public.cancellation_refund_claims
    WHERE id = p_claim_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cancellation claim not found or unauthorized';
    END IF;

    IF v_claim.status != 'pending_choice' THEN
        RAISE EXCEPTION 'Claim has already been resolved with status: %', v_claim.status;
    END IF;

    -- 3. If credit selected: issue credit atomically without Stripe refund
    IF p_choice = 'credit' THEN
        v_bonus_cents := v_claim.credit_amount_cents - v_claim.original_amount_cents;

        -- Ensure user balance row exists and lock it
        INSERT INTO public.user_platform_balances (user_id, balance_cents, lifetime_credited_cents, lifetime_spent_cents, bonus_earned_cents, updated_at)
        VALUES (p_user_id, 0, 0, 0, 0, NOW())
        ON CONFLICT (user_id) DO NOTHING;

        SELECT balance_cents INTO v_current_balance
        FROM public.user_platform_balances
        WHERE user_id = p_user_id
        FOR UPDATE;

        v_new_balance := v_current_balance + v_claim.credit_amount_cents;

        -- Update user balance
        UPDATE public.user_platform_balances
        SET balance_cents = v_new_balance,
            lifetime_credited_cents = lifetime_credited_cents + v_claim.credit_amount_cents,
            bonus_earned_cents = bonus_earned_cents + v_bonus_cents,
            updated_at = NOW()
        WHERE user_id = p_user_id;

        -- Insert ledger entry
        INSERT INTO public.user_platform_credit_ledger (
            user_id,
            amount_cents,
            balance_after_cents,
            transaction_type,
            description,
            reference_id,
            bonus_amount_cents,
            metadata
        ) VALUES (
            p_user_id,
            v_claim.credit_amount_cents,
            v_new_balance,
            'cancellation_credit',
            'Event cancellation credit with 10% bonus for claim ' || p_claim_id,
            v_claim.event_id::TEXT,
            v_bonus_cents,
            jsonb_build_object(
                'claim_id', p_claim_id,
                'rsvp_id', v_claim.rsvp_id,
                'original_amount_cents', v_claim.original_amount_cents,
                'bonus_cents', v_bonus_cents
            )
        );

        -- Update claim status
        UPDATE public.cancellation_refund_claims
        SET status = 'credit_issued',
            selected_option = 'credit',
            resolved_at = NOW()
        WHERE id = p_claim_id;

        RETURN jsonb_build_object(
            'success', true,
            'choice', 'credit',
            'credit_amount_cents', v_claim.credit_amount_cents,
            'bonus_amount_cents', v_bonus_cents,
            'new_balance_cents', v_new_balance
        );
    ELSE
        -- If card selected: return metadata so Edge Function can execute Stripe refund
        RETURN jsonb_build_object(
            'success', true,
            'choice', 'card',
            'original_amount_cents', v_claim.original_amount_cents,
            'rsvp_id', v_claim.rsvp_id,
            'event_id', v_claim.event_id
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 5. Atomic RPC: Apply Platform Credit to Checkout
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_platform_credit_to_checkout(
    p_user_id UUID,
    p_order_amount_cents INT,
    p_order_id TEXT,
    p_description TEXT DEFAULT 'Checkout platform credit deduction'
) RETURNS JSONB AS $$
DECLARE
    v_current_balance INT := 0;
    v_credit_to_deduct INT := 0;
    v_remaining_amount INT := 0;
    v_new_balance INT := 0;
BEGIN
    IF p_order_amount_cents <= 0 THEN
        RAISE EXCEPTION 'Order amount must be greater than zero';
    END IF;

    -- Ensure row exists
    INSERT INTO public.user_platform_balances (user_id, balance_cents, lifetime_credited_cents, lifetime_spent_cents, bonus_earned_cents, updated_at)
    VALUES (p_user_id, 0, 0, 0, 0, NOW())
    ON CONFLICT (user_id) DO NOTHING;

    -- Row lock balance
    SELECT balance_cents INTO v_current_balance
    FROM public.user_platform_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance <= 0 THEN
        RETURN jsonb_build_object(
            'credit_applied_cents', 0,
            'remaining_amount_cents', p_order_amount_cents,
            'new_balance_cents', 0,
            'fully_covered', false
        );
    END IF;

    -- Deduct minimum of balance or total amount
    v_credit_to_deduct := LEAST(v_current_balance, p_order_amount_cents);
    v_remaining_amount := p_order_amount_cents - v_credit_to_deduct;
    v_new_balance := v_current_balance - v_credit_to_deduct;

    -- Update balance
    UPDATE public.user_platform_balances
    SET balance_cents = v_new_balance,
        lifetime_spent_cents = lifetime_spent_cents + v_credit_to_deduct,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Log transaction
    INSERT INTO public.user_platform_credit_ledger (
        user_id,
        amount_cents,
        balance_after_cents,
        transaction_type,
        description,
        reference_id,
        bonus_amount_cents,
        metadata
    ) VALUES (
        p_user_id,
        -v_credit_to_deduct,
        v_new_balance,
        'checkout_deduction',
        p_description,
        p_order_id,
        0,
        jsonb_build_object(
            'order_id', p_order_id,
            'order_amount_cents', p_order_amount_cents,
            'remaining_cents', v_remaining_amount
        )
    );

    RETURN jsonb_build_object(
        'credit_applied_cents', v_credit_to_deduct,
        'remaining_amount_cents', v_remaining_amount,
        'new_balance_cents', v_new_balance,
        'fully_covered', (v_remaining_amount = 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.user_platform_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_platform_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_refund_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own platform balance"
ON public.user_platform_balances FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own credit ledger"
ON public.user_platform_credit_ledger FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view own cancellation claims"
ON public.cancellation_refund_claims FOR SELECT
USING (auth.uid() = user_id);
