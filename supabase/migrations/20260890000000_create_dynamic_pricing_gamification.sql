-- 1. Extend user_preferences table to store gamification_tier and dynamic pricing stats
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS gamification_tier TEXT DEFAULT 'Bronze' NOT NULL 
    CHECK (gamification_tier IN ('Bronze', 'Silver', 'Gold', 'Platinum')),
ADD COLUMN IF NOT EXISTS total_events_attended INTEGER DEFAULT 0 NOT NULL;

-- Index for fast tier-based checkout lookup
CREATE INDEX IF NOT EXISTS idx_user_gamification_tier ON user_preferences(user_id, gamification_tier);

-- 2. Stored RPC procedure to fetch user tier discount configuration
CREATE OR REPLACE FUNCTION get_user_checkout_discount_tier(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    gamification_tier TEXT,
    discount_percentage NUMERIC(5, 2),
    banner_message TEXT
) AS $$
DECLARE
    v_tier TEXT;
    v_discount NUMERIC(5, 2) := 0.00;
    v_banner TEXT := NULL;
BEGIN
    SELECT up.gamification_tier INTO v_tier
    FROM user_preferences up
    WHERE up.user_id = p_user_id;

    IF NOT FOUND THEN
        v_tier := 'Bronze';
    END IF;

    IF v_tier = 'Gold' THEN
        v_discount := 15.00;
        v_banner := 'Loyalty Reward: 15% applied automatically because you are a Gold Member!';
    ELSIF v_tier = 'Platinum' THEN
        v_discount := 20.00;
        v_banner := 'Loyalty Reward: 20% applied automatically because you are a Platinum Member!';
    ELSIF v_tier = 'Silver' THEN
        v_discount := 5.00;
        v_banner := 'Loyalty Reward: 5% applied automatically because you are a Silver Member!';
    END IF;

    RETURN QUERY SELECT p_user_id, v_tier, v_discount, v_banner;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;