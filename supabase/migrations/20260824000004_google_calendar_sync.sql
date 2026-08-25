-- Migration: 20260824000004_google_calendar_sync.sql
-- Purpose: Store Google Calendar OAuth tokens for authenticated users.

CREATE TABLE IF NOT EXISTS user_calendar_tokens (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_calendar_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_calendar_tokens_updated_at ON user_calendar_tokens;
CREATE TRIGGER update_calendar_tokens_updated_at
BEFORE UPDATE ON user_calendar_tokens
FOR EACH ROW
EXECUTE FUNCTION update_calendar_tokens_updated_at();
