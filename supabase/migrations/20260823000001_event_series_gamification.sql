-- Migration: 20260823000001_event_series_gamification.sql
-- Purpose: Add support for event series streak tracking and exponential gamification multipliers.

-- Ensure the event_series_id column exists in the events table
ALTER TABLE IF EXISTS events
ADD COLUMN IF NOT EXISTS event_series_id UUID REFERENCES event_series(id) ON DELETE SET NULL;

-- Create a table to track consecutive attendance for gamification
CREATE TABLE IF NOT EXISTS user_series_streaks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_series_id UUID REFERENCES event_series(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    last_attended_event_id UUID REFERENCES events(id),
    last_attended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, event_series_id)
);

-- Index for faster lookups during check-in
CREATE INDEX IF NOT EXISTS idx_user_series_streaks_user_series 
ON user_series_streaks(user_id, event_series_id);

-- Function to update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at column
DROP TRIGGER IF EXISTS update_user_series_streaks_updated_at ON user_series_streaks;
CREATE TRIGGER update_user_series_streaks_updated_at
BEFORE UPDATE ON user_series_streaks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add columns to the ledger_transactions table to link gamification rewards to streaks
ALTER TABLE IF EXISTS ledger_transactions
ADD COLUMN IF NOT EXISTS streak_multiplier DECIMAL(5,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS base_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_streak_bonus BOOLEAN DEFAULT FALSE;
