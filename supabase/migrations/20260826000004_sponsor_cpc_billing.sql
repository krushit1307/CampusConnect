-- Migration: 20260826000004_sponsor_cpc_billing.sql
-- Purpose: Add Cost-Per-Click (CPC) billing and click tracking for digital event sponsorships.

-- Create table for sponsor CPC settings
CREATE TABLE IF NOT EXISTS sponsor_cpc_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sponsor_id UUID REFERENCES sponsors(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    cost_per_click NUMERIC NOT NULL DEFAULT 0.50,
    max_budget NUMERIC NOT NULL,
    current_spent NUMERIC DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table to track individual clicks for fraud prevention
CREATE TABLE IF NOT EXISTS sponsor_clicks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sponsor_setting_id UUID REFERENCES sponsor_cpc_settings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address TEXT NOT NULL,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup of active CPC settings by event
CREATE INDEX IF NOT EXISTS idx_sponsor_cpc_event_active 
ON sponsor_cpc_settings(event_id, is_active) WHERE is_active = TRUE;

-- Index for rate limiting checks
CREATE INDEX IF NOT EXISTS idx_sponsor_clicks_ip_time 
ON sponsor_clicks(ip_address, clicked_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sponsor_cpc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sponsor_cpc_updated_at ON sponsor_cpc_settings;
CREATE TRIGGER update_sponsor_cpc_updated_at
BEFORE UPDATE ON sponsor_cpc_settings
FOR EACH ROW
EXECUTE FUNCTION update_sponsor_cpc_updated_at();
