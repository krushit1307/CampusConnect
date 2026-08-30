-- Migration: 20260828000001_drone_battery_degradation.sql
-- Purpose: Add predictive maintenance tracking and battery degradation metrics to hardware resources.

-- Add battery health and maintenance columns to resources table
ALTER TABLE IF EXISTS resources
ADD COLUMN IF NOT EXISTS total_flight_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS maintenance_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_maintenance_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS battery_health_percentage NUMERIC DEFAULT 100.00;

-- Add checkout duration tracking to resource bookings
ALTER TABLE IF EXISTS resource_bookings
ADD COLUMN IF NOT EXISTS checkout_duration_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_return_time TIMESTAMP WITH TIME ZONE;

-- Index for fast lookup of resources requiring maintenance
CREATE INDEX IF NOT EXISTS idx_resources_maintenance_required 
ON resources(maintenance_required) WHERE maintenance_required = TRUE;

-- Function to automatically calculate battery health based on flight minutes
-- Assumes 6000 minutes is end-of-life (100% degradation from 100% to 0%)
CREATE OR REPLACE FUNCTION calculate_battery_health()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate health: 100% - (total_minutes / 6000 * 100)
    NEW.battery_health_percentage = GREATEST(0, 100.00 - (NEW.total_flight_minutes / 6000.00 * 100.00));
    
    -- Flag for maintenance if approaching end of life (5500 minutes)
    IF NEW.total_flight_minutes >= 5500 THEN
        NEW.maintenance_required = TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_battery_health ON resources;
CREATE TRIGGER trigger_calculate_battery_health
BEFORE UPDATE OF total_flight_minutes ON resources
FOR EACH ROW
EXECUTE FUNCTION calculate_battery_health();
