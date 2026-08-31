-- =============================================================================
-- Migration: 20271002000000_defi_leveraged_yield_donations.sql
-- Description: Issue #5380 - MakerDAO CDP/Flash Minting leveraged yield donation & tax savings
-- =============================================================================

BEGIN;

-- 1. Upgrade lossless_yield_donations with MakerDAO CDP and Tax metrics
ALTER TABLE public.lossless_yield_donations
  ADD COLUMN IF NOT EXISTS collateral_asset VARCHAR DEFAULT 'ETH',
  ADD COLUMN IF NOT EXISTS collateral_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS debt_amount_dai NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_leveraged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS liquidation_ratio NUMERIC DEFAULT 150.00,
  ADD COLUMN IF NOT EXISTS liquidation_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_savings_usd NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leverage_multiplier NUMERIC DEFAULT 1.00;

-- 2. Create the simulate_maker_cdp_leverage RPC
CREATE OR REPLACE FUNCTION public.simulate_maker_cdp_leverage(
    p_donation_id UUID,
    p_collateral_amount NUMERIC,
    p_debt_amount_dai NUMERIC,
    p_eth_price NUMERIC DEFAULT 3000.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_donation RECORD;
    v_collateral_value NUMERIC;
    v_liquidation_price NUMERIC := 0;
    v_tax_savings NUMERIC := 0;
    v_leverage_mult NUMERIC := 1.00;
    v_result JSONB;
BEGIN
    -- 1. Fetch donation record
    SELECT * INTO v_donation FROM public.lossless_yield_donations
    WHERE id = p_donation_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Yield donation record not found.');
    END IF;

    -- 2. Calculate values
    v_collateral_value := p_collateral_amount * p_eth_price;
    
    IF p_debt_amount_dai > 0 THEN
        -- Liquidation Price = (Debt * (Liquidation Ratio / 100)) / Collateral Amount
        v_liquidation_price := (p_debt_amount_dai * (v_donation.liquidation_ratio / 100.00)) / p_collateral_amount;
        -- Leverage multiplier = (Collateral Value + Debt) / Collateral Value
        v_leverage_mult := (v_collateral_value + p_debt_amount_dai) / v_collateral_value;
    END IF;

    -- Standard US Capital Gains Tax Savings (20% federal + 13.3% state maximum/estimated = 33.3% rate on generated yield + collateral appreciation)
    v_tax_savings := (v_collateral_value * 0.20) + (p_debt_amount_dai * 0.05 * 0.33);

    -- 3. Update the record
    UPDATE public.lossless_yield_donations
    SET
        collateral_amount = p_collateral_amount,
        debt_amount_dai = p_debt_amount_dai,
        is_leveraged = TRUE,
        liquidation_price = v_liquidation_price,
        tax_savings_usd = v_tax_savings,
        leverage_multiplier = v_leverage_mult,
        principal_locked_usdc = v_collateral_value,
        updated_at = NOW()
    WHERE id = p_donation_id;

    SELECT jsonb_build_object(
        'success', TRUE,
        'collateral_value', v_collateral_value,
        'liquidation_price', v_liquidation_price,
        'tax_savings', v_tax_savings,
        'leverage_multiplier', v_leverage_mult
    ) INTO v_result;

    RETURN v_result;
END;
$$;

COMMIT;
