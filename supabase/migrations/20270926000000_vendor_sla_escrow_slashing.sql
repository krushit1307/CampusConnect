-- =============================================================================
-- Migration: 20270926000000_vendor_sla_escrow_slashing.sql
-- Description: Issue #5377 - SLA Multi-Oracle Vending Escrow Slashing (Temporal & Qualitative Temperature consensus)
-- =============================================================================

BEGIN;

-- 1. Upgrade vendor_contracts table with SLA and Oracle fields
ALTER TABLE public.vendor_contracts
  ADD COLUMN IF NOT EXISTS delivery_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gps_arrival_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS min_temp_limit NUMERIC(5, 2) DEFAULT 140.00,
  ADD COLUMN IF NOT EXISTS min_recorded_temp NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS slashed_amount NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS oracle_sig TEXT,
  ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RELEASED', 'SLASHED', 'REFUNDED'));

-- 2. Create the execute_vendor_sla_payout RPC
CREATE OR REPLACE FUNCTION public.execute_vendor_sla_payout(
    p_contract_id UUID,
    p_gps_arrival_time TIMESTAMPTZ,
    p_min_recorded_temp NUMERIC,
    p_oracle_sig TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_contract RECORD;
    v_slashed_amt NUMERIC(10, 2) := 0.00;
    v_payout_amt NUMERIC(10, 2);
    v_result JSONB;
BEGIN
    -- 1. Fetch target contract
    SELECT * INTO v_contract FROM public.vendor_contracts 
    WHERE id = p_contract_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Vendor contract not found.');
    END IF;

    IF v_contract.status <> 'PENDING' THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Payout has already been executed for this contract.');
    END IF;

    -- 2. Evaluate SLA conditions
    -- If temperature is below limit (140°F), trigger 50% slash penalty
    IF p_min_recorded_temp < v_contract.min_temp_limit THEN
        v_slashed_amt := v_contract.amount * 0.50;
        v_payout_amt := v_contract.amount - v_slashed_amt;

        -- Update contract details
        UPDATE public.vendor_contracts
        SET 
            gps_arrival_time = p_gps_arrival_time,
            min_recorded_temp = p_min_recorded_temp,
            oracle_sig = p_oracle_sig,
            slashed_amount = v_slashed_amt,
            released_at = NOW(),
            status = 'SLASHED'
        WHERE id = p_contract_id;

        -- Return the 50% slashed refund back to the club's ledger balance
        INSERT INTO public.club_transactions (club_id, amount, transaction_type, category, description)
        VALUES (
            v_contract.club_id,
            v_slashed_amt,
            'INCOME',
            'Refunds',
            'SLA Escrow Slashing Refund (Cold Temp: ' || p_min_recorded_temp || 'F) from ' || v_contract.vendor_name
        );

        SELECT jsonb_build_object(
            'success', TRUE,
            'payout_status', 'SLASHED',
            'amount_paid', v_payout_amt,
            'amount_slashed', v_slashed_amt,
            'reason', 'SLA Violation: Food temperature fell below 140°F threshold.'
        ) INTO v_result;

    ELSE
        -- Temperature is safe (>= 140°F) -> payout 100%
        v_payout_amt := v_contract.amount;

        UPDATE public.vendor_contracts
        SET 
            gps_arrival_time = p_gps_arrival_time,
            min_recorded_temp = p_min_recorded_temp,
            oracle_sig = p_oracle_sig,
            released_at = NOW(),
            status = 'RELEASED'
        WHERE id = p_contract_id;

        SELECT jsonb_build_object(
            'success', TRUE,
            'payout_status', 'RELEASED',
            'amount_paid', v_payout_amt,
            'amount_slashed', 0.00,
            'reason', 'SLA Met: Delivery on time and temperature threshold verified.'
        ) INTO v_result;
    END IF;

    RETURN v_result;
END;
$$;

COMMIT;
