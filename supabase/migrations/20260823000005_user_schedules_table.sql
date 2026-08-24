-- Migration: 20260823000005_user_schedules_table.sql
-- Purpose: Add user_schedules table to track academic conflicts for no-show penalty waivers.

CREATE TABLE IF NOT EXISTS user_schedules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    course_name TEXT NOT NULL,
    course_code TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_mandatory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast conflict lookups by user and day
CREATE INDEX IF NOT EXISTS idx_user_schedules_user_day 
ON user_schedules(user_id, day_of_week);

-- Function to update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_schedule_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_schedules_updated_at ON user_schedules;
CREATE TRIGGER update_user_schedules_updated_at
BEFORE UPDATE ON user_schedules
FOR EACH ROW
EXECUTE FUNCTION update_schedule_updated_at_column();
