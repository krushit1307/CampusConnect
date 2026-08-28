-- Create standardized dress code enum if it does not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dress_code') THEN
        CREATE TYPE public.dress_code AS ENUM ('casual', 'smart_casual', 'business_casual', 'formal');
    END IF;
END$$;

-- Add dress_code column to events table if it does not exist
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS dress_code public.dress_code NULL;
