-- Migration: 20260823000003_club_probation_status.sql
-- Purpose: Add probation status and compliance tracking to the clubs table.

-- Add status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE club_status AS ENUM ('active', 'probation', 'suspended', 'dissolved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update clubs table to include probation-specific fields
ALTER TABLE IF EXISTS clubs
ADD COLUMN IF NOT EXISTS status club_status DEFAULT 'active',
ADD COLUMN IF NOT EXISTS probation_reason TEXT,
ADD COLUMN IF NOT EXISTS probation_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS probation_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS compliance_acknowledged BOOLEAN DEFAULT FALSE;

-- Create a table to track compliance quiz submissions
CREATE TABLE IF NOT EXISTS club_compliance_submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    answers JSONB NOT NULL,
    passed BOOLEAN NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup of clubs on probation
CREATE INDEX IF NOT EXISTS idx_clubs_status_probation 
ON clubs(status) WHERE status = 'probation';
