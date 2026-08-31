-- Migration: 20260826000005_apology_workflow.sql
-- Purpose: Add apology tracking and LLM evaluation logs for user reinstatement.

-- Create table to track user apologies
CREATE TABLE IF NOT EXISTS user_apologies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    violation_id UUID REFERENCES moderation_violations(id) ON DELETE CASCADE,
    apology_text TEXT NOT NULL,
    llm_evaluation_score NUMERIC,
    llm_is_sincere BOOLEAN,
    llm_raw_response TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_reviewed_by UUID REFERENCES auth.users(id),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Index for fast lookup of pending apologies by user
CREATE INDEX IF NOT EXISTS idx_user_apologies_user_pending 
ON user_apologies(user_id, status) WHERE status = 'pending';

-- Index for admin dashboard filtering
CREATE INDEX IF NOT EXISTS idx_user_apologies_status 
ON user_apologies(status);

-- Function to update reviewed_at timestamp
CREATE OR REPLACE FUNCTION update_apology_reviewed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status != OLD.status AND NEW.status IN ('approved', 'rejected') THEN
        NEW.reviewed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_apologies_reviewed_at ON user_apologies;
CREATE TRIGGER update_user_apologies_reviewed_at
BEFORE UPDATE ON user_apologies
FOR EACH ROW
EXECUTE FUNCTION update_apology_reviewed_at();
