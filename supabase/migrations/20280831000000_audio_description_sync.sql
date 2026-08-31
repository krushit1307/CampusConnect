-- Migration: 20280831000000_audio_description_sync.sql
-- Description: Add audio description fields and NTP-time RPC

-- 1. Add columns to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS audio_description_url TEXT,
ADD COLUMN IF NOT EXISTS audio_description_enabled BOOLEAN DEFAULT false;

-- 2. Create get_current_db_timestamp function for NTP time synchronization
CREATE OR REPLACE FUNCTION public.get_current_db_timestamp()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
    SELECT NOW();
$$;
