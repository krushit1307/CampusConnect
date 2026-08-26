-- 1. Create Gamification Points Table (from Issue #2813)
CREATE TABLE IF NOT EXISTS gamification_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Referral Tracking Table
CREATE TABLE IF NOT EXISTS referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    points_awarded INTEGER DEFAULT 500,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    awarded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(referred_user_id) -- Enforces one referral reward per new user
);

-- RLS Policies
ALTER TABLE gamification_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Gamification Points Policies
CREATE POLICY "Users can view their own gamification points" ON gamification_points FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all gamification points" ON gamification_points FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM rbac_role_assignments WHERE role_id IN (SELECT id FROM rbac_roles WHERE name = 'System Admin'))
);

-- Referral Rewards Policies
CREATE POLICY "Users can view their own referrals" ON referral_rewards FOR SELECT USING (referrer_id = auth.uid() OR referred_user_id = auth.uid());
CREATE POLICY "Admins can view all referrals" ON referral_rewards FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM rbac_role_assignments WHERE role_id IN (SELECT id FROM rbac_roles WHERE name = 'System Admin'))
);
