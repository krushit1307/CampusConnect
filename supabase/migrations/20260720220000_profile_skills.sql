-- Migration: 20260720220000_profile_skills.sql
-- Description: Add skills text array column to profiles table with GIN index for fast array overlap searches

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}'::TEXT[];

CREATE INDEX IF NOT EXISTS idx_profiles_skills ON public.profiles USING gin (skills);
