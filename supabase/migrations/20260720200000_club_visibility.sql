-- Migration: 20260720200000_club_visibility.sql
-- Description: Add club_visibility ENUM ('public', 'private') and add visibility column to clubs table with 'public' default

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'club_visibility') THEN
        CREATE TYPE club_visibility AS ENUM ('public', 'private');
    END IF;
END $$;

ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS visibility club_visibility DEFAULT 'public'::club_visibility;
