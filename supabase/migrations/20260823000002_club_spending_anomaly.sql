-- Migration: 20260823000002_club_spending_anomaly.sql
-- Purpose: Add anomaly detection status and audit tracking to club transactions.

-- Add status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM ('completed', 'pending', 'pending_audit', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update ledger_transactions or club_transactions table to include audit fields
ALTER TABLE IF EXISTS club_transactions
ADD COLUMN IF NOT EXISTS status transaction_status DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS flagged_reasons TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS audited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS audited_by UUID REFERENCES auth.users(id);

-- Index for fast filtering of pending audit transactions
CREATE INDEX IF NOT EXISTS idx_club_transactions_status 
ON club_transactions(status) WHERE status = 'pending_audit';

-- Function to calculate club average and standard deviation for anomaly detection
CREATE OR REPLACE FUNCTION get_club_transaction_stats(p_club_id UUID)
RETURNS TABLE (avg_amount NUMERIC, std_dev_amount NUMERIC) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            AVG(amount) as avg_amt,
            STDDEV(amount) as std_amt
        FROM club_transactions
        WHERE club_id = p_club_id AND status = 'completed'
    )
    SELECT COALESCE(avg_amt, 0), COALESCE(std_amt, 0) FROM stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
