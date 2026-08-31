-- Migration: 20260827000004_github_classroom_verification.sql
-- Purpose: Add heuristic flagging and audit status for GitHub Classroom submissions.

-- Add submission analysis fields to student series progress
ALTER TABLE IF EXISTS user_series_progress
ADD COLUMN IF NOT EXISTS github_repo_url TEXT,
ADD COLUMN IF NOT EXISTS submission_status TEXT DEFAULT 'pending' CHECK (submission_status IN ('pending', 'attended', 'pending_audit', 'rejected')),
ADD COLUMN IF NOT EXISTS audit_reason TEXT,
ADD COLUMN IF NOT EXISTS commit_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lines_changed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE;

-- Index for fast lookup of submissions requiring audit
CREATE INDEX IF NOT EXISTS idx_user_series_progress_audit 
ON user_series_progress(submission_status) WHERE submission_status = 'pending_audit';

-- Function to update analyzed_at timestamp
CREATE OR REPLACE FUNCTION update_submission_analyzed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.submission_status != OLD.submission_status THEN
        NEW.analyzed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_series_progress_analyzed_at ON user_series_progress;
CREATE TRIGGER update_user_series_progress_analyzed_at
BEFORE UPDATE ON user_series_progress
FOR EACH ROW
EXECUTE FUNCTION update_submission_analyzed_at();
