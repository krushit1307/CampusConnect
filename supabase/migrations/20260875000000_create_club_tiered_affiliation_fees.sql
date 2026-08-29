-- 1. Extend clubs table to track lifetime revenue, tier rank, and platform fee rate
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS lifetime_revenue NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
ADD COLUMN IF NOT EXISTS leaderboard_rank TEXT DEFAULT 'Standard' NOT NULL CHECK (leaderboard_rank IN ('Standard', 'Silver', 'Gold', 'Platinum')),
ADD COLUMN IF NOT EXISTS current_fee_rate NUMERIC(4, 3) DEFAULT 0.050 NOT NULL;

-- Index for revenue leaderboard lookups
CREATE INDEX IF NOT EXISTS idx_clubs_revenue_rank ON clubs(lifetime_revenue DESC, leaderboard_rank);

-- 2. Stored RPC procedure to update club revenue and recalculate fee tier
CREATE OR REPLACE FUNCTION record_club_sale_and_update_fee_tier(
    p_club_id UUID,
    p_sale_amount NUMERIC(10, 2)
)
RETURNS TABLE (
    club_id UUID,
    new_lifetime_revenue NUMERIC(12, 2),
    new_leaderboard_rank TEXT,
    new_fee_rate NUMERIC(4, 3)
) AS $$
DECLARE
    v_total NUMERIC(12, 2);
    v_rank TEXT;
    v_rate NUMERIC(4, 3);
BEGIN
    -- Increment lifetime revenue
    UPDATE clubs
    SET lifetime_revenue = lifetime_revenue + p_sale_amount
    WHERE id = p_club_id
    RETURNING lifetime_revenue, leaderboard_rank INTO v_total, v_rank;

    -- Tier logic evaluation ($10k+ or Gold rank -> 3% fee)
    IF v_total >= 50000.00 OR v_rank = 'Platinum' THEN
        v_rank := 'Platinum';
        v_rate := 0.020; -- 2% super-tier
    ELSIF v_total >= 10000.00 OR v_rank = 'Gold' THEN
        v_rank := 'Gold';
        v_rate := 0.030; -- 3% gold tier target
    ELSIF v_total >= 2500.00 OR v_rank = 'Silver' THEN
        v_rank := 'Silver';
        v_rate := 0.040; -- 4% silver tier
    ELSE
        v_rank := 'Standard';
        v_rate := 0.050; -- 5% base rate
    END IF;

    -- Save updated rank and calculated fee rate
    UPDATE clubs
    SET leaderboard_rank = v_rank,
        current_fee_rate = v_rate
    WHERE id = p_club_id;

    RETURN QUERY SELECT p_club_id, v_total, v_rank, v_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;