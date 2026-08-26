-- Migration: 20260720000000_skills_matchmaking.sql
-- Description:
-- 1. Adds skills column to profiles table as a text array.
-- 2. Adds GIN index for performance on array operations.
-- 3. Creates the get_recommended_connections Postgres function to sort user connections by skill overlap.

-- Alter table profiles to add skills column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}'::TEXT[];

-- Create GIN index on skills for faster array containment/overlap queries
CREATE INDEX IF NOT EXISTS idx_profiles_skills ON public.profiles USING gin (skills);

-- Create matchmaking Postgres function
CREATE OR REPLACE FUNCTION public.get_recommended_connections(user_id UUID, limit_count INT)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  handle TEXT,
  skills TEXT[],
  match_count INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_skills TEXT[];
BEGIN
  -- Retrieve caller's skills array
  SELECT p.skills INTO caller_skills FROM public.profiles p WHERE p.id = user_id;
  
  -- If caller doesn't exist or has no skills, return empty set
  IF caller_skills IS NULL OR cardinality(caller_skills) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    p.handle,
    p.skills,
    COALESCE(cardinality(ARRAY(
      SELECT UNNEST(p.skills) 
      INTERSECT 
      SELECT UNNEST(caller_skills)
    )), 0)::INT AS match_count
  FROM public.profiles p
  WHERE p.id != user_id
    AND p.skills IS NOT NULL
    AND p.skills && caller_skills  -- Uses GIN index for overlapping skills
  ORDER BY match_count DESC, p.id ASC
  LIMIT limit_count;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.get_recommended_connections(UUID, INT) TO authenticated;
