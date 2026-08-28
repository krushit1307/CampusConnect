-- 1. Create vendor_contract_deliverables table
CREATE TABLE IF NOT EXISTS vendor_contract_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES vendor_contracts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    vendor_checked BOOLEAN DEFAULT FALSE NOT NULL,
    vendor_checked_at TIMESTAMPTZ,
    organizer_countersigned BOOLEAN DEFAULT FALSE NOT NULL,
    organizer_countersigned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for checklist verification queries
CREATE INDEX IF NOT EXISTS idx_contract_deliverables ON vendor_contract_deliverables(contract_id);

-- Enable RLS
ALTER TABLE vendor_contract_deliverables ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Vendor & Event Organizers can view and sign deliverables
CREATE POLICY "Parties can manage vendor contract deliverables"
    ON vendor_contract_deliverables FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM vendor_contracts vc
            JOIN event_organizers eo ON eo.event_id = vc.event_id
            WHERE vc.id = vendor_contract_deliverables.contract_id 
              AND (eo.user_id = auth.uid() OR vc.vendor_user_id = auth.uid())
        )
    );

-- 2. Stored RPC procedure to update deliverable signature state and check escrow release eligibility
CREATE OR REPLACE FUNCTION toggle_vendor_deliverable_signoff(
    p_deliverable_id UUID,
    p_user_id UUID,
    p_actor_role TEXT -- 'vendor' or 'organizer'
)
RETURNS TABLE (
    deliverable_id UUID,
    contract_id UUID,
    all_deliverables_completed BOOLEAN,
    escrow_unlocked BOOLEAN
) AS $$
DECLARE
    v_contract_id UUID;
    v_total_count INTEGER;
    v_completed_count INTEGER;
BEGIN
    SELECT contract_id INTO v_contract_id
    FROM vendor_contract_deliverables
    WHERE id = p_deliverable_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deliverable item not found.';
    END IF;

    IF p_actor_role = 'vendor' THEN
        UPDATE vendor_contract_deliverables
        SET vendor_checked = TRUE,
            vendor_checked_at = NOW()
        WHERE id = p_deliverable_id;
    ELSIF p_actor_role = 'organizer' THEN
        UPDATE vendor_contract_deliverables
        SET organizer_countersigned = TRUE,
            organizer_countersigned_at = NOW()
        WHERE id = p_deliverable_id;
    END IF;

    -- Evaluate whether 100% of items are mutually checked and countersigned
    SELECT COUNT(*), COUNT(*) FILTER (WHERE vendor_checked AND organizer_countersigned)
    INTO v_total_count, v_completed_count
    FROM vendor_contract_deliverables
    WHERE contract_id = v_contract_id;

    IF v_total_count > 0 AND v_total_count = v_completed_count THEN
        UPDATE vendor_contracts
        SET escrow_release_unlocked = TRUE,
            updated_at = NOW()
        WHERE id = v_contract_id;

        RETURN QUERY SELECT p_deliverable_id, v_contract_id, TRUE, TRUE;
    ELSE
        UPDATE vendor_contracts
        SET escrow_release_unlocked = FALSE,
            updated_at = NOW()
        WHERE id = v_contract_id;

        RETURN QUERY SELECT p_deliverable_id, v_contract_id, FALSE, FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;