-- Migration: Automated Event Cancellation Decentralized Insurance Pool with Prediction Market Hedging
-- Resolves #5144

CREATE TABLE IF NOT EXISTS public.event_insurance_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_name TEXT NOT NULL,
    total_liquidity NUMERIC(18, 2) NOT NULL DEFAULT 20000.00,
    hedged_liquidity NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    solvency_ratio NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES public.event_insurance_pools(id) ON DELETE CASCADE,
    club_id UUID NOT NULL,
    event_name TEXT NOT NULL,
    city TEXT NOT NULL,
    event_date DATE NOT NULL,
    premium_paid NUMERIC(18, 2) NOT NULL,
    coverage_amount NUMERIC(18, 2) NOT NULL,
    polymarket_condition_id TEXT NOT NULL,
    hedge_status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'TRIGGERED', 'EXPIRED', 'SETTLED'
    claimed BOOLEAN NOT NULL DEFAULT FALSE,
    payout_executed NUMERIC(18, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.prediction_market_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID REFERENCES public.event_insurance_policies(id) ON DELETE CASCADE,
    market_slug TEXT NOT NULL,
    outcome_token TEXT NOT NULL DEFAULT 'YES',
    capital_allocated NUMERIC(18, 2) NOT NULL,
    shares_bought NUMERIC(18, 4) NOT NULL,
    entry_odds NUMERIC(5, 4) NOT NULL,
    potential_payout NUMERIC(18, 2) NOT NULL,
    is_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RPC: Underwrite Policy and Execute Prediction Market Hedge
CREATE OR REPLACE FUNCTION public.underwrite_event_insurance_policy(
    p_pool_id UUID,
    p_club_id UUID,
    p_event_name TEXT,
    p_city TEXT,
    p_event_date DATE,
    p_premium NUMERIC(18, 2),
    p_coverage NUMERIC(18, 2),
    p_polymarket_condition_id TEXT
) RETURNS JSONB AS $$
DECLARE
    v_policy_id UUID;
    v_hedge_capital NUMERIC(18, 2);
    v_shares NUMERIC(18, 4);
    v_odds NUMERIC(5, 4) := 0.025; -- 2.5% market implied probability for extreme weather
    v_potential_payout NUMERIC(18, 2);
BEGIN
    v_hedge_capital := p_premium * 0.90;
    v_potential_payout := p_coverage;
    v_shares := v_hedge_capital / v_odds;

    -- Insert insurance policy
    INSERT INTO public.event_insurance_policies (
        pool_id, club_id, event_name, city, event_date, premium_paid, coverage_amount, polymarket_condition_id
    ) VALUES (
        p_pool_id, p_club_id, p_event_name, p_city, p_event_date, p_premium, p_coverage, p_polymarket_condition_id
    ) RETURNING id INTO v_policy_id;

    -- Execute hedge position on prediction market
    INSERT INTO public.prediction_market_positions (
        policy_id, market_slug, outcome_token, capital_allocated, shares_bought, entry_odds, potential_payout
    ) VALUES (
        v_policy_id, 'weather-cancellation-' || p_city || '-' || p_event_date, 'YES', v_hedge_capital, v_shares, v_odds, v_potential_payout
    );

    -- Update pool total liquidity & hedged liquidity
    UPDATE public.event_insurance_pools
    SET total_liquidity = total_liquidity + p_premium,
        hedged_liquidity = hedged_liquidity + v_potential_payout,
        updated_at = NOW()
    WHERE id = p_pool_id;

    RETURN jsonb_build_object(
        'success', true,
        'policy_id', v_policy_id,
        'hedge_capital', v_hedge_capital,
        'potential_payout', v_potential_payout
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Trigger Correlated Event Claim and Liquidate Prediction Market Hedge
CREATE OR REPLACE FUNCTION public.execute_correlated_event_claim(
    p_policy_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_pool_id UUID;
    v_coverage NUMERIC(18, 2);
    v_payout_fund NUMERIC(18, 2);
    v_claimed BOOLEAN;
    v_market_win NUMERIC(18, 2);
BEGIN
    SELECT pool_id, coverage_amount, claimed INTO v_pool_id, v_coverage, v_claimed
    FROM public.event_insurance_policies
    WHERE id = p_policy_id FOR UPDATE;

    IF v_claimed THEN
        RAISE EXCEPTION 'Policy already claimed';
    END IF;

    -- Redeem prediction market position
    SELECT potential_payout INTO v_market_win
    FROM public.prediction_market_positions
    WHERE policy_id = p_policy_id;

    IF v_market_win IS NULL THEN
        v_market_win := v_coverage;
    END IF;

    -- Redeem position into liquidity pool
    UPDATE public.prediction_market_positions
    SET is_redeemed = TRUE
    WHERE policy_id = p_policy_id;

    -- Inject prediction market win into pool, then execute payout
    UPDATE public.event_insurance_pools
    SET total_liquidity = total_liquidity + v_market_win - v_coverage,
        hedged_liquidity = GREATEST(0, hedged_liquidity - v_market_win),
        updated_at = NOW()
    WHERE id = v_pool_id;

    UPDATE public.event_insurance_policies
    SET claimed = TRUE,
        payout_executed = v_coverage,
        hedge_status = 'SETTLED'
    WHERE id = p_policy_id;

    RETURN jsonb_build_object(
        'success', true,
        'policy_id', p_policy_id,
        'payout_amount', v_coverage,
        'prediction_market_yield_redeemed', v_market_win
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
