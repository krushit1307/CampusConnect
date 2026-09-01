-- ============================================================
-- Migration: 20260829000005_cdp_health_monitor.sql
-- Issue: #5466 - Automated "Tax-Exempt" Crypto Capital Gains Calculator (DeFi Yield Donation Smart Routing via Flash Minting and Flashbot Protection)
-- Description:
--   1. Create cdp_positions table for tracking MakerDAO CDP positions
--   2. Create cdp_health_monitor table for health monitoring and alerts
--   3. Create flashbot_transactions table for private transaction tracking
--   4. Create oracle_price_history table for price tracking
--   5. Create RPC functions for CDP management and health monitoring
--   6. Create automated deleveraging trigger logic
-- ============================================================

SET lock_timeout = '3s';

-- 1. Create cdp_positions table
CREATE TABLE IF NOT EXISTS public.cdp_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    cdp_id TEXT NOT NULL UNIQUE, -- MakerDAO CDP ID
    vault_id TEXT, -- Alternative vault identifier
    
    -- Collateral information
    collateral_type TEXT NOT NULL DEFAULT 'ETH-A',
    collateral_amount NUMERIC(30, 18) NOT NULL,
    collateral_value_usd NUMERIC(30, 18) NOT NULL,
    
    -- Debt information
    debt_amount_dai NUMERIC(30, 18) NOT NULL,
    debt_value_usd NUMERIC(30, 18) NOT NULL,
    
    -- Health metrics
    collateralization_ratio NUMERIC(10, 4) NOT NULL,
    liquidation_ratio NUMERIC(10, 4) NOT NULL DEFAULT 1.5, -- 150%
    safety_threshold NUMERIC(10, 4) NOT NULL DEFAULT 1.8, -- 180%
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_liquidated BOOLEAN DEFAULT FALSE,
    is_deleveraging BOOLEAN DEFAULT FALSE,
    
    -- Flashbot protection
    use_flashbots BOOLEAN DEFAULT TRUE,
    flashbot_transaction_id UUID REFERENCES public.flashbot_transactions(id) ON DELETE SET NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_collateralization_ratio_positive CHECK (collateralization_ratio > 0),
    CONSTRAINT chk_collateral_amount_positive CHECK (collateral_amount >= 0),
    CONSTRAINT chk_debt_amount_positive CHECK (debt_amount_dai >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cdp_positions_user_id ON public.cdp_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_cdp_positions_cdp_id ON public.cdp_positions(cdp_id);
CREATE INDEX IF NOT EXISTS idx_cdp_positions_is_active ON public.cdp_positions(is_active);
CREATE INDEX IF NOT EXISTS idx_cdp_positions_collateralization_ratio ON public.cdp_positions(collateralization_ratio);

-- 2. Create cdp_health_monitor table
CREATE TABLE IF NOT EXISTS public.cdp_health_monitor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cdp_position_id UUID NOT NULL REFERENCES public.cdp_positions(id) ON DELETE CASCADE,
    
    -- Health metrics
    current_collateralization_ratio NUMERIC(10, 4) NOT NULL,
    current_collateral_value_usd NUMERIC(30, 18) NOT NULL,
    current_debt_value_usd NUMERIC(30, 18) NOT NULL,
    current_eth_price_usd NUMERIC(30, 18) NOT NULL,
    
    -- Alert status
    health_status TEXT NOT NULL DEFAULT 'healthy'
        CHECK (health_status IN ('healthy', 'warning', 'critical', 'liquidated')),
    alert_triggered BOOLEAN DEFAULT FALSE,
    alert_type TEXT,
    
    -- Deleveraging status
    deleveraging_triggered BOOLEAN DEFAULT FALSE,
    deleveraging_amount_dai NUMERIC(30, 18),
    deleveraging_timestamp TIMESTAMPTZ,
    
    -- Timestamps
    monitored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_current_collateralization_ratio_positive CHECK (current_collateralization_ratio > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cdp_health_monitor_cdp_position_id ON public.cdp_health_monitor(cdp_position_id);
CREATE INDEX IF NOT EXISTS idx_cdp_health_monitor_health_status ON public.cdp_health_monitor(health_status);
CREATE INDEX IF NOT EXISTS idx_cdp_health_monitor_monitored_at ON public.cdp_health_monitor(monitored_at DESC);

-- 3. Create flashbot_transactions table
CREATE TABLE IF NOT EXISTS public.flashbot_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    cdp_position_id UUID REFERENCES public.cdp_positions(id) ON DELETE SET NULL,
    
    -- Transaction details
    transaction_type TEXT NOT NULL
        CHECK (transaction_type IN ('flash_mint', 'deleveraging', 'liquidation', 'repayment')),
    transaction_hash TEXT,
    bundle_hash TEXT,
    
    -- Flashbot details
    flashbots_rpc_endpoint TEXT NOT NULL,
    block_number BIGINT,
    gas_price_gwei NUMERIC(20, 2),
    gas_used BIGINT,
    transaction_cost_usd NUMERIC(30, 18),
    
    -- MEV protection
    mev_savings_usd NUMERIC(30, 18),
    sandwich_attack_prevented BOOLEAN DEFAULT FALSE,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'submitted', 'included', 'failed', 'reverted')),
    
    -- Timestamps
    submitted_at TIMESTAMPTZ,
    included_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Error handling
    error_message TEXT,
    error_code TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_flashbot_transactions_user_id ON public.flashbot_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_flashbot_transactions_cdp_position_id ON public.flashbot_transactions(cdp_position_id);
CREATE INDEX IF NOT EXISTS idx_flashbot_transactions_status ON public.flashbot_transactions(status);
CREATE INDEX IF NOT EXISTS idx_flashbot_transactions_transaction_hash ON public.flashbot_transactions(transaction_hash);

-- 4. Create oracle_price_history table
CREATE TABLE IF NOT EXISTS public.oracle_price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Price data
    asset_symbol TEXT NOT NULL,
    price_usd NUMERIC(30, 18) NOT NULL,
    
    -- Oracle source
    oracle_source TEXT NOT NULL DEFAULT 'makerdao'
        CHECK (oracle_source IN ('makerdao', 'chainlink', 'uniswap', 'coingecko')),
    
    -- Additional data
    price_change_24h NUMERIC(10, 4),
    volume_24h NUMERIC(30, 18),
    
    -- Timestamps
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_price_usd_positive CHECK (price_usd > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_oracle_price_history_asset_symbol ON public.oracle_price_history(asset_symbol);
CREATE INDEX IF NOT EXISTS idx_oracle_price_history_recorded_at ON public.oracle_price_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_price_history_oracle_source ON public.oracle_price_history(oracle_source);

-- 5. Enable RLS
ALTER TABLE public.cdp_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdp_health_monitor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashbot_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_price_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cdp_positions
CREATE POLICY "Service role can manage CDP positions" ON public.cdp_positions
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own CDP positions" ON public.cdp_positions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all CDP positions" ON public.cdp_positions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for cdp_health_monitor
CREATE POLICY "Service role can manage CDP health monitor" ON public.cdp_health_monitor
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own CDP health data" ON public.cdp_health_monitor
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.cdp_positions
        WHERE id = cdp_health_monitor.cdp_position_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all CDP health data" ON public.cdp_health_monitor
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for flashbot_transactions
CREATE POLICY "Service role can manage flashbot transactions" ON public.flashbot_transactions
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view their own flashbot transactions" ON public.flashbot_transactions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all flashbot transactions" ON public.flashbot_transactions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- RLS Policies for oracle_price_history
CREATE POLICY "Service role can manage oracle price history" ON public.oracle_price_history
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can view oracle price history" ON public.oracle_price_history
FOR SELECT TO authenticated
USING (true);

-- 6. Create function to create CDP position
CREATE OR REPLACE FUNCTION public.create_cdp_position(
    p_user_id UUID,
    p_cdp_id TEXT,
    p_collateral_type TEXT DEFAULT 'ETH-A',
    p_collateral_amount NUMERIC,
    p_debt_amount_dai NUMERIC,
    p_use_flashbots BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_position_id UUID;
    v_eth_price NUMERIC;
BEGIN
    -- Get current ETH price from oracle
    SELECT price_usd INTO v_eth_price
    FROM public.oracle_price_history
    WHERE asset_symbol = 'ETH'
    ORDER BY recorded_at DESC
    LIMIT 1;
    
    IF v_eth_price IS NULL THEN
        v_eth_price := 3000.00; -- Fallback price
    END IF;
    
    -- Calculate values
    INSERT INTO public.cdp_positions (
        user_id, cdp_id, collateral_type, collateral_amount,
        collateral_value_usd, debt_amount_dai, debt_value_usd,
        collateralization_ratio, use_flashbots
    ) VALUES (
        p_user_id, p_cdp_id, p_collateral_type, p_collateral_amount,
        p_collateral_amount * v_eth_price, p_debt_amount_dai, p_debt_amount_dai,
        (p_collateral_amount * v_eth_price) / p_debt_amount_dai, p_use_flashbots
    ) RETURNING id INTO v_position_id;
    
    RETURN v_position_id;
END;
$$;

-- 7. Create function to update CDP health
CREATE OR REPLACE FUNCTION public.update_cdp_health(
    p_cdp_position_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_position RECORD;
    v_health_id UUID;
    v_health_status TEXT;
    v_alert_triggered BOOLEAN;
    v_alert_type TEXT;
BEGIN
    -- Get CDP position
    SELECT * INTO v_position
    FROM public.cdp_positions
    WHERE id = p_cdp_position_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Determine health status
    IF v_position.collateralization_ratio < v_position.liquidation_ratio THEN
        v_health_status := 'liquidated';
        v_alert_triggered := TRUE;
        v_alert_type := 'liquidation_imminent';
    ELSIF v_position.collateralization_ratio < v_position.safety_threshold THEN
        v_health_status := 'critical';
        v_alert_triggered := TRUE;
        v_alert_type := 'safety_threshold_breached';
    ELSIF v_position.collateralization_ratio < v_position.safety_threshold * 1.1 THEN
        v_health_status := 'warning';
        v_alert_triggered := FALSE;
        v_alert_type := NULL;
    ELSE
        v_health_status := 'healthy';
        v_alert_triggered := FALSE;
        v_alert_type := NULL;
    END IF;
    
    -- Insert health monitor record
    INSERT INTO public.cdp_health_monitor (
        cdp_position_id, current_collateralization_ratio,
        current_collateral_value_usd, current_debt_value_usd,
        current_eth_price_usd, health_status, alert_triggered, alert_type
    ) VALUES (
        p_cdp_position_id, v_position.collateralization_ratio,
        v_position.collateral_value_usd, v_position.debt_value_usd,
        v_position.collateral_value_usd / v_position.collateral_amount,
        v_health_status, v_alert_triggered, v_alert_type
    ) RETURNING id INTO v_health_id;
    
    -- Update CDP position if critical
    IF v_health_status = 'critical' AND NOT v_position.is_deleveraging THEN
        UPDATE public.cdp_positions
        SET is_deleveraging = TRUE
        WHERE id = p_cdp_position_id;
    END IF;
    
    RETURN v_health_id;
END;
$$;

-- 8. Create function to trigger deleveraging
CREATE OR REPLACE FUNCTION public.trigger_deleveraging(
    p_cdp_position_id UUID,
    p_deleveraging_amount_dai NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_position RECORD;
    v_flashbot_id UUID;
BEGIN
    -- Get CDP position
    SELECT * INTO v_position
    FROM public.cdp_positions
    WHERE id = p_cdp_position_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Create flashbot transaction for deleveraging
    INSERT INTO public.flashbot_transactions (
        user_id, cdp_position_id, transaction_type,
        flashbots_rpc_endpoint, status, submitted_at
    ) VALUES (
        v_position.user_id, p_cdp_position_id, 'deleveraging',
        'https://relay.flashbots.net', 'pending', NOW()
    ) RETURNING id INTO v_flashbot_id;
    
    -- Update CDP position with flashbot reference
    UPDATE public.cdp_positions
    SET flashbot_transaction_id = v_flashbot_id
    WHERE id = p_cdp_position_id;
    
    -- Update health monitor
    UPDATE public.cdp_health_monitor
    SET 
        deleveraging_triggered = TRUE,
        deleveraging_amount_dai = p_deleveraging_amount_dai,
        deleveraging_timestamp = NOW()
    WHERE cdp_position_id = p_cdp_position_id
    ORDER BY monitored_at DESC
    LIMIT 1;
    
    RETURN v_flashbot_id;
END;
$$;

-- 9. Create function to record oracle price
CREATE OR REPLACE FUNCTION public.record_oracle_price(
    p_asset_symbol TEXT,
    p_price_usd NUMERIC,
    p_oracle_source TEXT DEFAULT 'makerdao',
    p_price_change_24h NUMERIC DEFAULT NULL,
    p_volume_24h NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_price_id UUID;
BEGIN
    INSERT INTO public.oracle_price_history (
        asset_symbol, price_usd, oracle_source,
        price_change_24h, volume_24h
    ) VALUES (
        p_asset_symbol, p_price_usd, p_oracle_source,
        p_price_change_24h, p_volume_24h
    ) RETURNING id INTO v_price_id;
    
    -- Update all CDP positions with new price
    UPDATE public.cdp_positions
    SET 
        collateral_value_usd = collateral_amount * p_price_usd,
        collateralization_ratio = (collateral_amount * p_price_usd) / debt_amount_dai,
        updated_at = NOW()
    WHERE collateral_type = 'ETH-A' AND is_active = TRUE;
    
    -- Trigger health updates for all active positions
    INSERT INTO public.cdp_health_monitor (
        cdp_position_id, current_collateralization_ratio,
        current_collateral_value_usd, current_debt_value_usd,
        current_eth_price_usd, health_status, alert_triggered, alert_type
    )
    SELECT 
        id, collateralization_ratio, collateral_value_usd, debt_value_usd,
        p_price_usd,
        CASE 
            WHEN collateralization_ratio < liquidation_ratio THEN 'liquidated'
            WHEN collateralization_ratio < safety_threshold THEN 'critical'
            WHEN collateralization_ratio < safety_threshold * 1.1 THEN 'warning'
            ELSE 'healthy'
        END,
        CASE 
            WHEN collateralization_ratio < liquidation_ratio THEN TRUE
            WHEN collateralization_ratio < safety_threshold THEN TRUE
            ELSE FALSE
        END,
        CASE 
            WHEN collateralization_ratio < liquidation_ratio THEN 'liquidation_imminent'
            WHEN collateralization_ratio < safety_threshold THEN 'safety_threshold_breached'
            ELSE NULL
        END
    FROM public.cdp_positions
    WHERE is_active = TRUE;
    
    RETURN v_price_id;
END;
$$;

-- 10. Create function to get latest oracle price
CREATE OR REPLACE FUNCTION public.get_latest_oracle_price(p_asset_symbol TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_price NUMERIC;
BEGIN
    SELECT price_usd INTO v_price
    FROM public.oracle_price_history
    WHERE asset_symbol = p_asset_symbol
    ORDER BY recorded_at DESC
    LIMIT 1;
    
    RETURN v_price;
END;
$$;

-- 11. Create function to get CDP health summary
CREATE OR REPLACE FUNCTION public.get_cdp_health_summary(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    cdp_id TEXT,
    collateralization_ratio NUMERIC,
    health_status TEXT,
    is_deleveraging BOOLEAN,
    alert_triggered BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.cdp_id,
        p.collateralization_ratio,
        COALESCE(h.health_status, 'unknown'),
        p.is_deleveraging,
        COALESCE(h.alert_triggered, FALSE)
    FROM public.cdp_positions p
    LEFT JOIN LATERAL (
        SELECT health_status, alert_triggered
        FROM public.cdp_health_monitor
        WHERE cdp_position_id = p.id
        ORDER BY monitored_at DESC
        LIMIT 1
    ) h ON TRUE
    WHERE (p_user_id IS NULL OR p.user_id = p_user_id)
      AND p.is_active = TRUE;
END;
$$;

-- 12. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_cdp_position(UUID, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_cdp_health(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_deleveraging(UUID, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_oracle_price(TEXT, NUMERIC, TEXT, NUMERIC, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_latest_oracle_price(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cdp_health_summary(UUID) TO authenticated;
