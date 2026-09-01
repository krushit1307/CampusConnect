-- 1. Extend events table to support surge pricing configurations and live state
ALTER TABLE events
ADD COLUMN IF NOT EXISTS is_surge_enabled BOOLEAN DEFAULT TRUE NOT NULL,
ADD COLUMN IF NOT EXISTS is_surge_active BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS base_ticket_price_cents INTEGER DEFAULT 1000 NOT NULL,
ADD COLUMN IF NOT EXISTS current_ticket_price_cents INTEGER DEFAULT 1000 NOT NULL,
ADD COLUMN IF NOT EXISTS active_surge_multiplier NUMERIC(4, 2) DEFAULT 1.00 NOT NULL,
ADD COLUMN IF NOT EXISTS remaining_tickets INTEGER DEFAULT 100 NOT NULL,
ADD COLUMN IF NOT EXISTS active_checkout_viewers INTEGER DEFAULT 0 NOT NULL;

-- Index for real-time ticket pricing lookups
CREATE INDEX IF NOT EXISTS idx_events_surge_state ON events(id, is_surge_active);

-- 2. Stored RPC procedure to evaluate demand velocity and apply surge multipliers
CREATE OR REPLACE FUNCTION evaluate_event_surge_pricing(
    p_event_id UUID,
    p_active_viewers INTEGER,
    p_remaining_tickets INTEGER
)
RETURNS TABLE (
    event_id UUID,
    demand_ratio NUMERIC(6, 2),
    is_surge_active BOOLEAN,
    surge_multiplier NUMERIC(4, 2),
    final_ticket_price_cents INTEGER,
    surge_warning_message TEXT
) AS $$
DECLARE
    v_base_price INTEGER;
    v_enabled BOOLEAN;
    v_ratio NUMERIC(6, 2) := 0.00;
    v_surge_active BOOLEAN := FALSE;
    v_multiplier NUMERIC(4, 2) := 1.00;
    v_final_price INTEGER;
    v_message TEXT := NULL;
BEGIN
    SELECT base_ticket_price_cents, is_surge_enabled
    INTO v_base_price, v_enabled
    FROM events
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event record not found.';
    END IF;

    -- Avoid division by zero if inventory is 0
    IF p_remaining_tickets > 0 THEN
        v_ratio := ROUND((p_active_viewers::NUMERIC / p_remaining_tickets::NUMERIC), 2);
    ELSE
        v_ratio := 999.99;
    END IF;

    -- Apply surge multiplier thresholds if surge is enabled
    IF v_enabled AND v_ratio >= 5.0 THEN
        v_surge_active := TRUE;
        IF v_ratio >= 20.0 THEN
            v_multiplier := 2.00; -- 2.0x surge for extreme viral demand
        ELSIF v_ratio >= 10.0 THEN
            v_multiplier := 1.75;
        ELSE
            v_multiplier := 1.50; -- 1.5x surge for ratio >= 5.0
        END IF;

        v_final_price := ROUND(v_base_price * v_multiplier);
        v_message := 'SURGE PRICING ACTIVE: Due to extreme demand, ticket prices have temporarily increased.';
    ELSE
        v_surge_active := FALSE;
        v_multiplier := 1.00;
        v_final_price := v_base_price;
    END IF;

    -- Update event state
    UPDATE events
    SET is_surge_active = v_surge_active,
        active_surge_multiplier = v_multiplier,
        current_ticket_price_cents = v_final_price,
        active_checkout_viewers = p_active_viewers,
        remaining_tickets = p_remaining_tickets,
        updated_at = NOW()
    WHERE id = p_event_id;

    RETURN QUERY SELECT p_event_id, v_ratio, v_surge_active, v_multiplier, v_final_price, v_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;