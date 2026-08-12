-- 1. Create points_ledger table
CREATE TABLE IF NOT EXISTS points_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast user score calculations
CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON points_ledger(user_id);

-- 2. Create user_badges table
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL,
    awarded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, badge_id)
);

-- Index for user badges
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- Enable RLS
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view points ledger" ON points_ledger FOR SELECT USING (true);
CREATE POLICY "Users can view badges" ON user_badges FOR SELECT USING (true);