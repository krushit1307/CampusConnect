-- Migration: Real-Time Dynamic Pricing Dutch Auction with RL Yield Management AI Agent
-- Resolves #5145

CREATE TABLE IF NOT EXISTS public.dutch_auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    title TEXT NOT NULL,
    initial_price NUMERIC(18, 2) NOT NULL,
    current_price NUMERIC(18, 2) NOT NULL,
    floor_price NUMERIC(18, 2) NOT NULL,
    total_tickets INT NOT NULL,
    remaining_tickets INT NOT NULL,
    clock_paused BOOLEAN NOT NULL DEFAULT FALSE,
    hybrid_boost_active BOOLEAN NOT NULL DEFAULT FALSE,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auction_velocity_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES public.dutch_auctions(id) ON DELETE CASCADE,
    velocity_tickets_per_sec NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    window_duration_sec INT NOT NULL DEFAULT 5,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rl_agent_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES public.dutch_auctions(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'DECAY_PRICE_NORMAL', 'PAUSE_CLOCK', 'MICRO_BOOST_PRICE', 'STABILIZE_FLOOR'
    previous_price NUMERIC(18, 2) NOT NULL,
    adjusted_price NUMERIC(18, 2) NOT NULL,
    demand_elasticity_index NUMERIC(8, 2) NOT NULL,
    estimated_revenue_lift NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    decision_reasoning TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RPC: Execute Real-time RL Yield Optimization Step
CREATE OR REPLACE FUNCTION public.evaluate_auction_rl_yield_step(
    p_auction_id UUID,
    p_purchase_velocity NUMERIC(8, 2)
) RETURNS JSONB AS $$
DECLARE
    v_auction public.dutch_auctions%ROWTYPE;
    v_action TEXT := 'DECAY_PRICE_NORMAL';
    v_new_price NUMERIC(18, 2);
    v_paused BOOLEAN := FALSE;
    v_elasticity NUMERIC(8, 2);
    v_revenue_lift NUMERIC(18, 2) := 0.00;
    v_reasoning TEXT;
BEGIN
    SELECT * INTO v_auction FROM public.dutch_auctions WHERE id = p_auction_id FOR UPDATE;

    IF v_auction.id IS NULL THEN
        RAISE EXCEPTION 'Auction not found';
    END IF;

    -- Record velocity metric
    INSERT INTO public.auction_velocity_metrics (auction_id, velocity_tickets_per_sec)
    VALUES (p_auction_id, p_purchase_velocity);

    v_elasticity := p_purchase_velocity * (1.0 + (1.0 - (v_auction.remaining_tickets::NUMERIC / v_auction.total_tickets::NUMERIC)));

    -- RL Decision Boundaries
    IF p_purchase_velocity >= 15.0 THEN
        -- Massive velocity burst -> Micro-boost price upward
        v_action := 'MICRO_BOOST_PRICE';
        v_new_price := LEAST(v_auction.initial_price, v_auction.current_price + 2.00);
        v_paused := TRUE;
        v_revenue_lift := (v_new_price - v_auction.current_price) * v_auction.remaining_tickets * 0.40;
        v_reasoning := 'Explosive demand velocity >= 15 t/s. RL Agent triggered Micro-Boost price +$2.00 & paused decay clock.';
    ELSIF p_purchase_velocity >= 5.0 THEN
        -- High velocity -> Pause clock
        v_action := 'PAUSE_CLOCK';
        v_new_price := v_auction.current_price;
        v_paused := TRUE;
        v_revenue_lift := 150.00;
        v_reasoning := 'Velocity spike >= 5 t/s. Dynamic clock paused at current price.';
    ELSE
        -- Normal linear price decay
        v_action := 'DECAY_PRICE_NORMAL';
        v_new_price := GREATEST(v_auction.floor_price, v_auction.current_price - 1.00);
        v_paused := FALSE;
        v_reasoning := 'Low velocity. Normal price clock decay.';
    END IF;

    -- Update Auction State
    UPDATE public.dutch_auctions
    SET current_price = v_new_price,
        clock_paused = v_paused,
        hybrid_boost_active = (v_action = 'MICRO_BOOST_PRICE'),
        updated_at = NOW()
    WHERE id = p_auction_id;

    -- Log RL Decision
    INSERT INTO public.rl_agent_decisions (
        auction_id, action_type, previous_price, adjusted_price, demand_elasticity_index, estimated_revenue_lift, decision_reasoning
    ) VALUES (
        p_auction_id, v_action, v_auction.current_price, v_new_price, v_elasticity, v_revenue_lift, v_reasoning
    );

    RETURN jsonb_build_object(
        'success', true,
        'action', v_action,
        'previous_price', v_auction.current_price,
        'adjusted_price', v_new_price,
        'clock_paused', v_paused,
        'revenue_lift', v_revenue_lift,
        'reasoning', v_reasoning
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
