-- Add has_completed_tour column to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS has_completed_tour BOOLEAN DEFAULT FALSE;
