-- Migration: 20260720210000_club_social_links.sql
-- Description: Add social_links JSONB column to clubs table with URL validation check constraint

CREATE OR REPLACE FUNCTION public.is_valid_social_links(links jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 
    links IS NULL OR (
      jsonb_typeof(links) = 'object'
      AND NOT EXISTS (
        SELECT 1 
        FROM jsonb_each_text(links) 
        WHERE value NOT LIKE 'http://%' AND value NOT LIKE 'https://%'
      )
    );
$$;

ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_clubs_social_links_valid'
    ) THEN
        ALTER TABLE public.clubs
        ADD CONSTRAINT check_clubs_social_links_valid
        CHECK (public.is_valid_social_links(social_links));
    END IF;
END $$;
