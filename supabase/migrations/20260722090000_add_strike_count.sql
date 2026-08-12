-- Migration: 20260722060000_add_strike_count.sql
-- Description: Implement a three-strike rule system for user moderation. Add a `strike_count` integer column to the `profiles` table that admins can increment when users misbehave.

-- 1. Add `strike_count` column with default value 0
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS strike_count INTEGER DEFAULT 0;

-- 2. Add check constraint ensuring `strike_count` is between 0 and 3
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_strike_count_check') THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_strike_count_check 
        CHECK (strike_count >= 0 AND strike_count <= 3);
    END IF;
END $$;

-- 3. Update the system admin RLS policy to allow system admins to update this column (and other columns)
DROP POLICY IF EXISTS "System admins can update profiles." ON public.profiles;
CREATE POLICY "System admins can update profiles." 
ON public.profiles 
FOR UPDATE 
USING (public.is_system_admin());
