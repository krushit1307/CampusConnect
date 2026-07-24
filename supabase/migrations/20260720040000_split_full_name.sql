-- ============================================================
-- Migration: 20260720040000_split_full_name.sql
-- Description:
-- Splits profiles.full_name into first_name and last_name columns,
-- migrates existing data, then drops the full_name column.
-- ============================================================

-- Drop dependent functions before dropping full_name column to avoid PostgreSQL dependency errors
DROP FUNCTION IF EXISTS public.get_recommended_connections(UUID, INT);
DROP FUNCTION IF EXISTS public.get_event_member_emails(UUID);
DROP FUNCTION IF EXISTS public.get_digest_subscribers();

-- 1. Add new columns (nullable initially to avoid constraint issues)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Migrate existing data:
--    - first_name: text before first space (or the whole string if no space)
--    - last_name:  text after first space (or NULL if no space)
UPDATE profiles
SET
  first_name = CASE
    WHEN full_name IS NULL OR full_name = '' THEN NULL
    WHEN POSITION(' ' IN full_name) > 0 THEN SUBSTRING(full_name FROM 1 FOR POSITION(' ' IN full_name) - 1)
    ELSE full_name
  END,
  last_name = CASE
    WHEN full_name IS NULL OR full_name = '' THEN NULL
    WHEN POSITION(' ' IN full_name) > 0 THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE NULL
  END
WHERE full_name IS NOT NULL AND full_name != '';

-- 3. Drop the old full_name column
ALTER TABLE profiles
DROP COLUMN IF EXISTS full_name;

-- 4. Add NOT NULL constraint after migration (since we migrated all data)
--    Future inserts via trigger will always provide both values
ALTER TABLE profiles
ALTER COLUMN first_name SET NOT NULL,
ALTER COLUMN last_name SET NOT NULL;

-- 5. Update public.handle_new_user() trigger function to populate first_name & last_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  v_full_name := new.raw_user_meta_data->>'full_name';
  v_first_name := new.raw_user_meta_data->>'first_name';
  v_last_name := new.raw_user_meta_data->>'last_name';

  -- Prefer first_name/last_name from metadata; fall back to splitting full_name
  IF v_first_name IS NULL OR v_first_name = '' THEN
    IF v_full_name IS NOT NULL AND v_full_name != '' THEN
      IF POSITION(' ' IN v_full_name) > 0 THEN
        v_first_name := SUBSTRING(v_full_name FROM 1 FOR POSITION(' ' IN v_full_name) - 1);
        v_last_name := SUBSTRING(v_full_name FROM POSITION(' ' IN v_full_name) + 1);
      ELSE
        v_first_name := v_full_name;
      END IF;
    ELSE
      v_first_name := 'User';
      v_last_name := '';
    END IF;
  END IF;

  IF v_last_name IS NULL THEN
    v_last_name := '';
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, avatar_url)
  VALUES (new.id, v_first_name, v_last_name, new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Update get_event_member_emails RPC function to concatenate first_name and last_name
CREATE OR REPLACE FUNCTION get_event_member_emails(p_event_id UUID)
RETURNS TABLE (email TEXT, full_name TEXT) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.email::TEXT,
    TRIM(CONCAT(p.first_name, ' ', p.last_name))::TEXT AS full_name
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.id
  JOIN public.club_members cm ON cm.user_id = u.id
  JOIN public.events e ON e.club_id = cm.club_id
  WHERE e.id = p_event_id
    AND cm.status = 'approved';
END;
$$;

-- 7. Update get_digest_subscribers RPC function to concatenate first_name and last_name
CREATE OR REPLACE FUNCTION get_digest_subscribers()
RETURNS TABLE (email TEXT, full_name TEXT) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.email::TEXT,
    TRIM(CONCAT(p.first_name, ' ', p.last_name))::TEXT AS full_name
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.id
  WHERE (p.notification_preferences->>'digest')::BOOLEAN = true
    AND p.role = 'student';
END;
$$;

-- 8. Recreate public.get_recommended_connections using first_name and last_name
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
    TRIM(CONCAT(p.first_name, ' ', p.last_name))::TEXT AS full_name,
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
