-- ============================================================
-- Migration: 007_profiles_rls.sql
-- Description:
-- Enforces stricter Row Level Security (RLS) on profiles:
-- 1. Drops existing loose policies on profiles table.
-- 2. Restricts read access (SELECT) to authenticated users only.
-- 3. Restricts write access (UPDATE) to the profile owners (auth.uid() = id).
-- ============================================================

-- Drop old policies on profiles table to avoid conflicts
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- Ensure Row Level Security is active on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. Add an RLS policy that allows SELECT for all authenticated users
DROP POLICY IF EXISTS "Allow SELECT for all authenticated users" ON public.profiles;
CREATE POLICY "Allow SELECT for all authenticated users" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (true);

-- 2. Add an RLS policy that allows UPDATE only if auth.uid() = id (preventing role escalation)
DROP POLICY IF EXISTS "Allow UPDATE only if auth.uid() = id" ON public.profiles;
CREATE POLICY "Allow UPDATE only if auth.uid() = id" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (
  auth.uid() = id AND 
  role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);
