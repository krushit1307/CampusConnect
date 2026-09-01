-- 1. Create vendor_contract_milestones table for fractional escrow releases
CREATE TABLE IF NOT EXISTS vendor_contract_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES vendor_contracts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    milestone_order INTEGER NOT NULL,
    payout_percentage NUMERIC(5, 2) NOT NULL CHECK (payout_percentage > 0 AND payout_percentage <= 100),
    payout_amount NUMERIC(10, 2) NOT NULL CHECK (payout_amount >= 0),
    deliverable_id UUID REFERENCES vendor_contract_deliverables(id) ON DELETE SET NULL,
    is_released BOOLEAN DEFAULT FALSE NOT NULL,
    released_at TIMESTAMPTZ,
    stripe_transfer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for milestone lookup by contract
CREATE INDEX IF NOT EXISTS idx_milestones_contract ON vendor_contract_milestones(contract_id, milestone_order ASC);

-- Enable RLS
ALTER TABLE vendor_contract_milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Vendor and Organizers can view contract milestones
CREATE POLICY "Contract parties can view milestones"
    ON vendor_contract_milestones FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM vendor_contracts vc
            WHERE vc.id = vendor_contract_milestones.contract_id 
              AND (vc.vendor_user_id = auth.uid() OR vc.club_id IN (
                  SELECT club_id FROM club_members WHERE user_id = auth.uid()
              ))
        )
    );

-- 2. Stored RPC procedure to release a fractional escrow milestone
CREATE OR REPLACE FUNCTION release_escrow_milestone_payout(
    p_milestone_id UUID,
    p_stripe_transfer_id TEXT DEFAULT 'tr_mock_payout'
)
RETURNS TABLE (
    milestone_id UUID,
    contract_id UUID,
    released_amount NUMERIC(10, 2),
    total_released_to_date NUMERIC(10, 2),
    contract_total_amount NUMERIC(10, 2),
    financial_progress_percentage NUMERIC(5, 2)
) AS $$
DECLARE
    v_contract_id UUID;
    v_amount NUMERIC(10, 2);
    v_contract_total NUMERIC(10, 2);
    v_already_released BOOLEAN;
    v_sum_released NUMERIC(10, 2);
    v_progress NUMERIC(5, 2);
BEGIN
    SELECT contract_id, payout_amount, is_released
    INTO v_contract_id, v_amount, v_already_released
    FROM vendor_contract_milestones
    WHERE id = p_milestone_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Milestone record not found.';
    END IF;

    IF v_already_released THEN
        RAISE EXCEPTION 'Milestone has already been released.';
    END IF;

    SELECT agreed_amount INTO v_contract_total
    FROM vendor_contracts
    WHERE id = v_contract_id;

    UPDATE vendor_contract_milestones
    SET is_released = TRUE,
        released_at = NOW(),
        stripe_transfer_id = p_stripe_transfer_id
    WHERE id = p_milestone_id;

    SELECT COALESCE(SUM(payout_amount), 0.00) INTO v_sum_released
    FROM vendor_contract_milestones
    WHERE contract_id = v_contract_id AND is_released = TRUE;

    v_progress := ROUND((v_sum_released / v_contract_total) * 100.0, 2);

    RETURN QUERY SELECT p_milestone_id, v_contract_id, v_amount, v_sum_released, v_contract_total, v_progress;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;