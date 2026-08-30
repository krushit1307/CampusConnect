-- 1. Extend user_preferences to track total donations and donor badge tier
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS lifetime_donations NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
ADD COLUMN IF NOT EXISTS donor_tier TEXT DEFAULT 'None' NOT NULL 
    CHECK (donor_tier IN ('None', 'Bronze', 'Silver', 'Gold', 'Platinum'));

-- Index for real-time donor lookup
CREATE INDEX IF NOT EXISTS idx_user_donor_tier ON user_preferences(user_id, donor_tier);

-- 2. Stored RPC procedure executed upon successful donation webhook
CREATE OR REPLACE FUNCTION record_donation_and_calculate_badge_tier(
    p_user_id UUID,
    p_donation_amount NUMERIC(10, 2)
)
RETURNS TABLE (
    user_id UUID,
    total_donations NUMERIC(12, 2),
    previous_tier TEXT,
    new_tier TEXT,
    tier_upgraded BOOLEAN
) AS $$
DECLARE
    v_old_total NUMERIC(12, 2);
    v_new_total NUMERIC(12, 2);
    v_old_tier TEXT;
    v_new_tier TEXT;
BEGIN
    SELECT lifetime_donations, donor_tier INTO v_old_total, v_old_tier
    FROM user_preferences
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found.';
    END IF;

    v_new_total := v_old_total + p_donation_amount;

    -- Tier thresholds: $100 = Bronze, $500 = Silver, $1000 = Gold, $5000 = Platinum
    IF v_new_total >= 5000.00 THEN
        v_new_tier := 'Platinum';
    ELSIF v_new_total >= 1000.00 THEN
        v_new_tier := 'Gold';
    ELSIF v_new_total >= 500.00 THEN
        v_new_tier := 'Silver';
    ELSIF v_new_total >= 100.00 THEN
        v_new_tier := 'Bronze';
    ELSE
        v_new_tier := 'None';
    END IF;

    UPDATE user_preferences
    SET lifetime_donations = v_new_total,
        donor_tier = v_new_tier,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN QUERY SELECT 
        p_user_id, 
        v_new_total, 
        v_old_tier, 
        v_new_tier, 
        (v_old_tier != v_new_tier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;