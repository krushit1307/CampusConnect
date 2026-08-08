-- Migration: 20260808000000_newsletter_opt_in_digest_rpc.sql
-- Description: Update get_digest_subscribers() to include users with newsletter_opt_in = true or notification_preferences.digest = true

CREATE OR REPLACE FUNCTION public.get_digest_subscribers()
RETURNS TABLE (email TEXT, full_name TEXT) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.email::TEXT,
    COALESCE(
      NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''),
      NULLIF(p.full_name, ''),
      'Student'
    )::TEXT AS full_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  WHERE (
    (u.raw_user_meta_data->>'newsletter_opt_in')::BOOLEAN = true
    OR (p.notification_preferences->>'digest')::BOOLEAN = true
  )
  AND u.email IS NOT NULL;
END;
$$;

-- Revoke from public, grant to service_role so only edge functions/admins can call it
REVOKE EXECUTE ON FUNCTION public.get_digest_subscribers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_digest_subscribers() TO service_role;
