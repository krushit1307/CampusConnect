-- Migration: 20260825000002_churn_model_tables.sql
-- Purpose: Add churn risk tracking and engagement signal logging for event series.

CREATE TABLE IF NOT EXISTS user_series_churn_risk (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_series_id UUID REFERENCES event_series(id) ON DELETE CASCADE,
    flight_risk_score INTEGER NOT NULL CHECK (flight_risk_score >= 0 AND flight_risk_score <= 100),
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    engagement_signals JSONB DEFAULT '[]'::jsonb,
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, event_series_id)
);

-- Index for organizers to quickly find high-risk students
CREATE INDEX IF NOT EXISTS idx_churn_risk_series_high 
ON user_series_churn_risk(event_series_id, flight_risk_score DESC) 
WHERE risk_level = 'high';

-- Function to update last_calculated_at
CREATE OR REPLACE FUNCTION update_churn_risk_calculated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_calculated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_churn_risk_calculated_at ON user_series_churn_risk;
CREATE TRIGGER update_churn_risk_calculated_at
BEFORE UPDATE ON user_series_churn_risk
FOR EACH ROW
EXECUTE FUNCTION update_churn_risk_calculated_at();
