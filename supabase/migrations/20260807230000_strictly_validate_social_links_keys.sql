-- Migration: 20260807230000_strictly_validate_social_links_keys.sql
-- Description: Strictly validate social_links JSONB keys in Postgres (#2305)

-- 1. Pre-migration sanitize step: remove/sanitize any unrecognized keys from existing records
UPDATE public.clubs
SET social_links = (
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
  FROM jsonb_each(social_links)
  WHERE key IN ('instagram', 'twitter', 'linkedin', 'website', 'github')
)
WHERE social_links IS NOT NULL AND jsonb_typeof(social_links) = 'object';

-- 2. Function to enforce strict key allowlist check on social_links JSONB
CREATE OR REPLACE FUNCTION public.is_valid_social_links_keys(links jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    links IS NULL OR (
      jsonb_typeof(links) = 'object'
      AND (
        SELECT COUNT(*)
        FROM jsonb_object_keys(links) AS keys
        WHERE keys NOT IN ('instagram', 'twitter', 'linkedin', 'website', 'github')
      ) = 0
    );
$$;

-- 3. Add CHECK constraint to the clubs table to reject unrecognized keys instantly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_social_keys'
  ) THEN
    ALTER TABLE public.clubs
    ADD CONSTRAINT valid_social_keys
    CHECK (public.is_valid_social_links_keys(social_links));
  END IF;
END $$;
