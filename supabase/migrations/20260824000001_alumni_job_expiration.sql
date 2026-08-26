-- Migration: 20260824000001_alumni_job_expiration.sql
-- Purpose: Add expiration tracking, archival status, and renewal tokens to alumni_jobs table.

-- Add status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('active', 'archived', 'filled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update alumni_jobs table to include expiration and archival fields
ALTER TABLE IF EXISTS alumni_jobs
ADD COLUMN IF NOT EXISTS status job_status DEFAULT 'active',
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '60 days'),
ADD COLUMN IF NOT EXISTS renewal_token UUID DEFAULT uuid_generate_v4(),
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Index for fast querying of active jobs
CREATE INDEX IF NOT EXISTS idx_alumni_jobs_status_active 
ON alumni_jobs(status) WHERE status = 'active';

-- Index for cron job to find jobs expiring soon or already expired
CREATE INDEX IF NOT EXISTS idx_alumni_jobs_expires_at 
ON alumni_jobs(expires_at);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_alumni_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at column
DROP TRIGGER IF EXISTS update_alumni_jobs_updated_at ON alumni_jobs;
CREATE TRIGGER update_alumni_jobs_updated_at
BEFORE UPDATE ON alumni_jobs
FOR EACH ROW
EXECUTE FUNCTION update_alumni_jobs_updated_at();
