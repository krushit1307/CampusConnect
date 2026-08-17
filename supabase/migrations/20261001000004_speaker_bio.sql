-- =============================================================================
-- Migration: Automated Speaker Bio Fetching
-- Issue: #3339 - Implement 'Automated Speaker Bio Fetching'
-- Description: Adds columns to the events table to store the guest speaker's 
-- LinkedIn URL and the AI-generated professional biography.
-- =============================================================================

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS speaker_name TEXT,
ADD COLUMN IF NOT EXISTS speaker_linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS speaker_bio TEXT,
ADD COLUMN IF NOT EXISTS speaker_photo_url TEXT;

COMMENT ON COLUMN public.events.speaker_linkedin_url IS 'Public LinkedIn profile URL used for bio scraping.';
COMMENT ON COLUMN public.events.speaker_bio IS 'AI-summarized professional biography generated from work history.';
