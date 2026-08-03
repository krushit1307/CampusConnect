-- Migration: Cleanup dormant accounts
-- Description: Anonymizes PII for users inactive for more than 3 years.
-- Uses auth.users.last_sign_in_at since there is no last_active_at in profiles.

CREATE OR REPLACE FUNCTION public.cleanup_dormant_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  processed_count integer := 0;
BEGIN
  -- We identify dormant users via auth.users since profiles lacks a last_active_at column.
  WITH dormant_users AS (
    SELECT id
    FROM auth.users
    WHERE last_sign_in_at < (NOW() - INTERVAL '3 years')
       OR (last_sign_in_at IS NULL AND created_at < (NOW() - INTERVAL '3 years'))
  ),
  updated_profiles AS (
    UPDATE public.profiles p
    SET 
      first_name = 'Anonymized',
      last_name = 'User',
      avatar_url = NULL,
      handle = 'anon_' || substr(md5(random()::text), 1, 8),
      linkedin_url = NULL,
      phone_number = NULL,
      bio = 'Account has been anonymized due to inactivity.'
    FROM dormant_users d
    WHERE p.id = d.id
    RETURNING p.id
  )
  SELECT count(*) INTO processed_count FROM updated_profiles;

  -- Also anonymize the underlying auth.users table for full PII removal
  UPDATE auth.users u
  SET 
    email = 'anon_' || substr(md5(random()::text), 1, 8) || '@anonymized.local',
    phone = NULL,
    raw_user_meta_data = '{}'::jsonb
  FROM (
    SELECT id
    FROM auth.users
    WHERE last_sign_in_at < (NOW() - INTERVAL '3 years')
       OR (last_sign_in_at IS NULL AND created_at < (NOW() - INTERVAL '3 years'))
  ) d
  WHERE u.id = d.id;

  RETURN processed_count;
END;
$$;

-- Schedule the cleanup function to run weekly (every Sunday at midnight)
DO $$
BEGIN
  PERFORM cron.schedule('cleanup-dormant-accounts', '0 0 * * 0', 'SELECT public.cleanup_dormant_accounts();');
EXCEPTION
  WHEN duplicate_object THEN
    -- In case the schedule already exists
    NULL;
END
$$;
