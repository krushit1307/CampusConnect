-- Migration to add a secure RPC function to fetch emails of users who opted in to weekly digests
-- This allows Edge Functions to fetch subscriber emails without exposing auth.users directly.

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
    p.full_name::TEXT
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.id
  WHERE (p.notification_preferences->>'digest')::BOOLEAN = true
    AND p.role = 'student';
END;
$$;

-- Revoke from public, grant to service_role so only edge functions/admins can call it
REVOKE EXECUTE ON FUNCTION get_digest_subscribers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_digest_subscribers() TO service_role;
