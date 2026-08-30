-- Migration: 20260826000001_resource_damage_deposit.sql
-- Purpose: Add damage deposit requirements and hold tracking for hardware resources.

-- Add deposit_required column to resources table
ALTER TABLE IF EXISTS resources
ADD COLUMN IF NOT EXISTS deposit_required NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS deposit_held BOOLEAN DEFAULT FALSE;

-- Create a table to track deposit holds
CREATE TABLE IF NOT EXISTS resource_deposit_holds (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES resource_bookings(id) ON DELETE CASCADE,
    hold_amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'released', 'deducted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT
);

-- Index for fast lookup of active holds by club
CREATE INDEX IF NOT EXISTS idx_resource_holds_club_active 
ON resource_deposit_holds(club_id, status) WHERE status = 'active';

-- Function to update resolved_at timestamp
CREATE OR REPLACE FUNCTION update_hold_resolved_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status != OLD.status AND NEW.status IN ('released', 'deducted') THEN
        NEW.resolved_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_resource_deposit_holds_resolved_at ON resource_deposit_holds;
CREATE TRIGGER update_resource_deposit_holds_resolved_at
BEFORE UPDATE ON resource_deposit_holds
FOR EACH ROW
EXECUTE FUNCTION update_hold_resolved_at();
