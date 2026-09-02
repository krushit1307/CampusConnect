-- =============================================================================
-- Migration: 20270922000000_vending_machine_integration.sql
-- Description: Issue #5058 - Smart Vending Machine Integration & Real-time Ledger Deductions
-- =============================================================================

BEGIN;

-- 1. Create event_vending_allocations table
CREATE TABLE IF NOT EXISTS public.event_vending_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    allocated_amount NUMERIC(10,2) NOT NULL CHECK (allocated_amount > 0),
    spent_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (spent_amount >= 0),
    per_user_limit NUMERIC(10,2) NOT NULL DEFAULT 10.00 CHECK (per_user_limit > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id)
);

-- 2. Create vending_user_credits table
CREATE TABLE IF NOT EXISTS public.vending_user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES public.event_vending_allocations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    spent_balance NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (spent_balance >= 0),
    qr_code_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(allocation_id, user_id)
);

-- 3. Create vending_dispense_logs table
CREATE TABLE IF NOT EXISTS public.vending_dispense_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_id UUID NOT NULL REFERENCES public.vending_user_credits(id) ON DELETE CASCADE,
    vending_machine_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    amount_deducted NUMERIC(10,2) NOT NULL CHECK (amount_deducted > 0),
    dispensed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.event_vending_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vending_user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vending_dispense_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Allow public select of vending allocations"
ON public.event_vending_allocations FOR SELECT USING (true);

CREATE POLICY "Allow public select of vending user credits"
ON public.vending_user_credits FOR SELECT USING (true);

CREATE POLICY "Allow public select of vending logs"
ON public.vending_dispense_logs FOR SELECT USING (true);

CREATE POLICY "Allow authenticated manage of vending allocations"
ON public.event_vending_allocations FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated manage of vending user credits"
ON public.vending_user_credits FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow authenticated manage of vending logs"
ON public.vending_dispense_logs FOR ALL TO authenticated USING (true);

-- 6. POS Vending Dispense RPC
CREATE OR REPLACE FUNCTION public.dispense_vending_item(
    p_qr_code_token TEXT,
    p_vending_machine_id TEXT,
    p_product_name TEXT,
    p_item_cost NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_credit RECORD;
    v_allocation RECORD;
    v_club_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Fetch user credit details using QR token
    SELECT * INTO v_credit FROM public.vending_user_credits 
    WHERE qr_code_token = p_qr_code_token;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid or unrecognized QR scan token.');
    END IF;

    IF v_credit.expires_at < NOW() THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'QR scan token has expired.');
    END IF;

    -- 2. Fetch event allocation limits
    SELECT * INTO v_allocation FROM public.event_vending_allocations 
    WHERE id = v_credit.allocation_id;

    -- 3. Check per-user limit
    IF (v_credit.spent_balance + p_item_cost) > v_allocation.per_user_limit THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Transaction exceeds student credit limit.');
    END IF;

    -- 4. Check total event allocation cap
    IF (v_allocation.spent_amount + p_item_cost) > v_allocation.allocated_amount THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Transaction exceeds event snack budget allocation limit.');
    END IF;

    -- 5. Fetch event's hosting club
    SELECT club_id INTO v_club_id FROM public.events 
    WHERE id = v_allocation.event_id;

    -- 6. Apply atomic updates & deduct from club's financial ledger in real-time
    UPDATE public.vending_user_credits 
    SET spent_balance = spent_balance + p_item_cost
    WHERE id = v_credit.id;

    UPDATE public.event_vending_allocations 
    SET spent_amount = spent_amount + p_item_cost
    WHERE id = v_allocation.id;

    INSERT INTO public.vending_dispense_logs (credit_id, vending_machine_id, product_name, amount_deducted)
    VALUES (v_credit.id, p_vending_machine_id, p_product_name, p_item_cost);

    -- Insert expense transaction
    INSERT INTO public.club_transactions (club_id, amount, transaction_type, category, description)
    VALUES (
        v_club_id, 
        -p_item_cost, 
        'EXPENSE', 
        'Food', 
        'Smart Vending - Dispensed ' || p_product_name || ' (Machine: ' || p_vending_machine_id || ')'
    );

    SELECT jsonb_build_object(
        'success', TRUE,
        'dispense_status', 'SUCCESS',
        'product_name', p_product_name,
        'amount_deducted', p_item_cost,
        'remaining_credit', v_allocation.per_user_limit - (v_credit.spent_balance + p_item_cost)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

COMMIT;
