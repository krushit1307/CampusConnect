-- Migration: 20260824000005_tutoring_credits.sql
-- Purpose: Add tutoring credits ledger to support automated dropout rescue workflows.

CREATE TABLE IF NOT EXISTS tutoring_credits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_series_id UUID REFERENCES event_series(id) ON DELETE SET NULL,
    credits_granted INTEGER NOT NULL DEFAULT 1,
    credits_used INTEGER NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- Index for fast lookup of active credits by user
CREATE INDEX IF NOT EXISTS idx_tutoring_credits_user_active 
ON tutoring_credits(user_id) WHERE credits_used < credits_granted;

-- Function to calculate total available credits for a user
CREATE OR REPLACE FUNCTION get_available_tutoring_credits(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_credits INTEGER;
BEGIN
    SELECT COALESCE(SUM(credits_granted - credits_used), 0)
    INTO total_credits
    FROM tutoring_credits
    WHERE user_id = p_user_id 
      AND credits_used < credits_granted
      AND expires_at > NOW();
      
    RETURN total_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
