-- Migration: 20260826000003_evacuation_routes.sql
-- Purpose: Add evacuation route tracking to venue layouts for fire marshal compliance.

-- Add evacuation_routes JSONB column to venue_layouts table
ALTER TABLE IF EXISTS venue_layouts
ADD COLUMN IF NOT EXISTS evacuation_routes JSONB DEFAULT '[]'::jsonb;

-- Function to validate evacuation routes JSON structure (basic check)
CREATE OR REPLACE FUNCTION validate_evacuation_routes()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure evacuation_routes is a valid JSON array
    IF jsonb_typeof(NEW.evacuation_routes) != 'array' THEN
        RAISE EXCEPTION 'evacuation_routes must be a JSON array';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_evacuation_routes ON venue_layouts;
CREATE TRIGGER trigger_validate_evacuation_routes
BEFORE INSERT OR UPDATE ON venue_layouts
FOR EACH ROW
EXECUTE FUNCTION validate_evacuation_routes();
