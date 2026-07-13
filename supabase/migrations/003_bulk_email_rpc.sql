-- Migration to add a secure RPC function to fetch club member emails for a specific event
-- This is needed because Edge Functions using the service_role key can access this RPC,
-- while normal users cannot access auth.users directly.

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
    p.full_name::TEXT
  FROM auth.users u
  JOIN public.profiles p ON u.id = p.id
  JOIN public.club_members cm ON cm.user_id = u.id
  JOIN public.events e ON e.club_id = cm.club_id
  WHERE e.id = p_event_id
    AND cm.status = 'approved';
END;
$$;

REVOKE EXECUTE ON FUNCTION get_event_member_emails(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_event_member_emails(UUID) TO service_role;
