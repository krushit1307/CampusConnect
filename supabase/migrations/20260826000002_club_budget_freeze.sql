-- Migration: 20260826000002_club_budget_freeze.sql
-- Purpose: Add financial status tracking and minimum reserve requirements for clubs.

-- Add financial_status and minimum_reserve to clubs table
ALTER TABLE IF EXISTS clubs
ADD COLUMN IF NOT EXISTS financial_status TEXT DEFAULT 'active' CHECK (financial_status IN ('active', 'frozen', 'restricted')),
ADD COLUMN IF NOT EXISTS minimum_reserve NUMERIC DEFAULT 100.00,
ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS frozen_reason TEXT;

-- Index for fast lookup of frozen clubs
CREATE INDEX IF NOT EXISTS idx_clubs_financial_status_frozen 
ON clubs(financial_status) WHERE financial_status = 'frozen';

-- Function to automatically check and update financial status based on balance
CREATE OR REPLACE FUNCTION check_club_budget_freeze()
RETURNS TRIGGER AS $$
BEGIN
    -- If balance drops below minimum reserve and status is active, freeze it
    IF NEW.ledger_balance < NEW.minimum_reserve AND NEW.financial_status = 'active' THEN
        NEW.financial_status := 'frozen';
        NEW.frozen_at := NOW();
        NEW.frozen_reason := 'Ledger balance dropped below minimum reserve ($' || NEW.minimum_reserve || ')';
    -- If balance recovers and status is frozen, unfreeze it
    ELSIF NEW.ledger_balance >= NEW.minimum_reserve AND NEW.financial_status = 'frozen' THEN
        NEW.financial_status := 'active';
        NEW.frozen_at := NULL;
        NEW.frozen_reason := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_club_budget_freeze ON clubs;
CREATE TRIGGER trigger_check_club_budget_freeze
BEFORE UPDATE OF ledger_balance ON clubs
FOR EACH ROW
EXECUTE FUNCTION check_club_budget_freeze();
