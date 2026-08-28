-- 1. Extend corporate_sponsorships table to support CPC budget caps and spending state
ALTER TABLE corporate_sponsorships
ADD COLUMN IF NOT EXISTS max_budget NUMERIC(10, 2) DEFAULT 100.00 NOT NULL,
ADD COLUMN IF NOT EXISTS current_spend NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
ADD COLUMN IF NOT EXISTS cost_per_click NUMERIC(10, 2) DEFAULT 0.50 NOT NULL,
ADD COLUMN IF NOT EXISTS is_budget_exhausted BOOLEAN DEFAULT FALSE NOT NULL;

-- Index for fast budget-check lookups
CREATE INDEX IF NOT EXISTS idx_sponsorship_budget ON corporate_sponsorships(id, is_budget_exhausted);

-- 2. Stored RPC procedure for atomic budget record updates & fallback state flag
CREATE OR REPLACE FUNCTION record_sponsor_click_and_check_budget(
    p_sponsorship_id UUID,
    p_cpc_amount NUMERIC(10, 2)
)
RETURNS TABLE (
    sponsorship_id UUID,
    new_total_spend NUMERIC(10, 2),
    max_budget NUMERIC(10, 2),
    is_exhausted BOOLEAN,
    trigger_websocket_removal BOOLEAN
) AS $$
DECLARE
    v_max NUMERIC(10, 2);
    v_current NUMERIC(10, 2);
    v_was_exhausted BOOLEAN;
    v_new_exhausted BOOLEAN;
BEGIN
    SELECT current_spend, max_budget, is_budget_exhausted
    INTO v_current, v_max, v_was_exhausted
    FROM corporate_sponsorships
    WHERE id = p_sponsorship_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sponsorship record not found.';
    END IF;

    IF v_was_exhausted THEN
        RETURN QUERY SELECT p_sponsorship_id, v_current, v_max, TRUE, FALSE;
        RETURN;
    END IF;

    v_current := v_current + p_cpc_amount;
    v_new_exhausted := (v_current >= v_max);

    UPDATE corporate_sponsorships
    SET current_spend = v_current,
        is_budget_exhausted = v_new_exhausted,
        updated_at = NOW()
    WHERE id = p_sponsorship_id;

    RETURN QUERY SELECT 
        p_sponsorship_id, 
        v_current, 
        v_max, 
        v_new_exhausted, 
        (v_new_exhausted AND NOT v_was_exhausted);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;