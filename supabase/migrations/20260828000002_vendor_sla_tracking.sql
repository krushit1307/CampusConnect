-- Migration: 20260828000002_vendor_sla_tracking.sql
-- Purpose: Add Service Level Agreement (SLA) tracking and penalty calculation to vendor milestones.

-- Add SLA columns to vendor_milestones table
ALTER TABLE IF EXISTS vendor_milestones
ADD COLUMN IF NOT EXISTS deadline_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
ADD COLUMN IF NOT EXISTS actual_arrival_timestamp TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sla_penalty_percentage NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS sla_penalty_amount NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS final_payout_amount NUMERIC;

-- Index for fast lookup of overdue milestones
CREATE INDEX IF NOT EXISTS idx_vendor_milestones_deadline 
ON vendor_milestones(deadline_timestamp) WHERE actual_arrival_timestamp IS NULL;

-- Function to automatically calculate SLA penalty and final payout
CREATE OR REPLACE FUNCTION calculate_sla_penalty()
RETURNS TRIGGER AS $$
DECLARE
    delay_minutes INTEGER;
    penalty_percentage NUMERIC;
    penalty_amount NUMERIC;
    original_amount NUMERIC;
BEGIN
    -- Only calculate if arrival is recorded and it's late
    IF NEW.actual_arrival_timestamp IS NOT NULL AND NEW.actual_arrival_timestamp > NEW.deadline_timestamp THEN
        -- Calculate delay in minutes
        delay_minutes = EXTRACT(EPOCH FROM (NEW.actual_arrival_timestamp - NEW.deadline_timestamp))::INTEGER / 60;
        
        -- Algorithmic slash: 5% for every 15 minutes late, capped at 50%
        penalty_percentage = LEAST(50.00, (delay_minutes / 15) * 5.00);
        
        -- Fetch original amount (assuming it's stored in a related table or passed, mocked here as 1000 for calculation)
        -- In production: SELECT amount INTO original_amount FROM vendor_contracts WHERE milestone_id = NEW.id;
        original_amount = 1000.00; 
        
        penalty_amount = original_amount * (penalty_percentage / 100.00);
        
        NEW.sla_penalty_percentage = penalty_percentage;
        NEW.sla_penalty_amount = penalty_amount;
        NEW.final_payout_amount = original_amount - penalty_amount;
    ELSE
        NEW.sla_penalty_percentage = 0.00;
        NEW.sla_penalty_amount = 0.00;
        -- NEW.final_payout_amount = original_amount;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_sla_penalty ON vendor_milestones;
CREATE TRIGGER trigger_calculate_sla_penalty
BEFORE UPDATE OF actual_arrival_timestamp ON vendor_milestones
FOR EACH ROW
EXECUTE FUNCTION calculate_sla_penalty();
