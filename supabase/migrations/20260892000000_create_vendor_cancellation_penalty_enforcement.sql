-- 1. Extend vendor_contracts table to track cancellation SLA violations and penalty payouts
ALTER TABLE vendor_contracts
ADD COLUMN IF NOT EXISTS cancellation_status TEXT DEFAULT 'active' NOT NULL 
    CHECK (cancellation_status IN ('active', 'cancelled_by_vendor', 'cancelled_by_organizer', 'completed')),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sla_violation_flagged BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS flake_penalty_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
ADD COLUMN IF NOT EXISTS club_damages_payout NUMERIC(10, 2) DEFAULT 0.00 NOT NULL;

-- Index for penalty audit lookups
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_cancellation ON vendor_contracts(cancellation_status, sla_violation_flagged);

-- 2. Stored RPC procedure to process vendor cancellation and execute flake penalty deduction
CREATE OR REPLACE FUNCTION process_vendor_cancellation_penalty(
    p_contract_id UUID,
    p_cancellation_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    contract_id UUID,
    club_id UUID,
    vendor_user_id UUID,
    is_sla_violated BOOLEAN,
    escrow_refund_amount NUMERIC(10, 2),
    penalty_deduction_amount NUMERIC(10, 2),
    total_club_payout NUMERIC(10, 2)
) AS $$
DECLARE
    v_contract_amount NUMERIC(10, 2);
    v_event_start TIMESTAMPTZ;
    v_club_id UUID;
    v_vendor_id UUID;
    v_hours_until_event NUMERIC;
    v_is_sla_violated BOOLEAN := FALSE;
    v_penalty NUMERIC(10, 2) := 0.00;
BEGIN
    SELECT 
        vc.agreed_amount, 
        e.start_time, 
        vc.club_id, 
        vc.vendor_user_id 
    INTO 
        v_contract_amount, 
        v_event_start, 
        v_club_id, 
        v_vendor_id
    FROM vendor_contracts vc
    JOIN events e ON e.id = vc.event_id
    WHERE vc.id = p_contract_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Contract record not found.';
    END IF;

    -- Calculate time delta in hours
    v_hours_until_event := EXTRACT(EPOCH FROM (v_event_start - p_cancellation_time)) / 3600.0;

    -- SLA violation if cancelled less than 24 hours prior to event start
    IF v_hours_until_event < 24.0 THEN
        v_is_sla_violated := TRUE;
        v_penalty := ROUND(v_contract_amount * 0.20, 2); -- 20% Flake Penalty
    END IF;

    -- Execute record updates
    UPDATE vendor_contracts
    SET cancellation_status = 'cancelled_by_vendor',
        cancelled_at = p_cancellation_time,
        sla_violation_flagged = v_is_sla_violated,
        flake_penalty_amount = v_penalty,
        club_damages_payout = v_contract_amount + v_penalty,
        updated_at = NOW()
    WHERE id = p_contract_id;

    RETURN QUERY SELECT 
        p_contract_id, 
        v_club_id, 
        v_vendor_id, 
        v_is_sla_violated, 
        v_contract_amount, -- 100% escrow refund
        v_penalty,         -- 20% vendor penalty
        v_contract_amount + v_penalty; -- Total club recovery
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;