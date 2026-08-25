-- Migration: 20260823000006_dropout_prediction_tracking.sql
-- Purpose: Add tracking and risk status for event series dropout prediction.

-- Add dropout risk status to user event attendance or a dedicated tracking table
CREATE TABLE IF NOT EXISTS user_series_engagement (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_series_id UUID REFERENCES event_series(id) ON DELETE CASCADE,
    risk_status TEXT DEFAULT 'stable' CHECK (risk_status IN ('stable', 'at_risk', 'dropped')),
    average_check_in_delta_minutes NUMERIC DEFAULT 0.0,
    delta_trend TEXT DEFAULT 'neutral', -- 'improving', 'neutral', 'declining'
    last_analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, event_series_id)
);

-- Index for organizers to quickly find at-risk students
CREATE INDEX IF NOT EXISTS idx_user_series_engagement_risk 
ON user_series_engagement(event_series_id, risk_status) WHERE risk_status = 'at_risk';

-- Function to update last_analyzed_at
CREATE OR REPLACE FUNCTION update_engagement_analyzed_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_analyzed_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_series_engagement_analyzed_at ON user_series_engagement;
CREATE TRIGGER update_user_series_engagement_analyzed_at
BEFORE UPDATE ON user_series_engagement
FOR EACH ROW
EXECUTE FUNCTION update_engagement_analyzed_at();
