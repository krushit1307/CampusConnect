-- Migration: 20260825000001_venue_facilities_update.sql
-- Purpose: Add structured facility nodes and layout tracking to venues.

-- Ensure venue_facilities table exists or update it
CREATE TABLE IF NOT EXISTS venue_layouts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    background_image_url TEXT,
    grid_size INTEGER DEFAULT 20,
    facilities_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup of layouts by venue
CREATE INDEX IF NOT EXISTS idx_venue_layouts_venue_id 
ON venue_layouts(venue_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_venue_layouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_venue_layouts_updated_at ON venue_layouts;
CREATE TRIGGER update_venue_layouts_updated_at
BEFORE UPDATE ON venue_layouts
FOR EACH ROW
EXECUTE FUNCTION update_venue_layouts_updated_at();

