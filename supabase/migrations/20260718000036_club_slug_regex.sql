-- Migration: Add check constraint to the clubs table slug column
-- Ensures slug only contains lowercase letters, numbers, and hyphens

ALTER TABLE public.clubs
ADD CONSTRAINT check_clubs_slug_format
CHECK (slug ~ '^[a-z0-9-]+$');
