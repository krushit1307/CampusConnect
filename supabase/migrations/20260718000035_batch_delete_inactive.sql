-- Migration: Batch delete inactive accounts
-- Function to clean up accounts inactive for more than 180 days.

CREATE OR REPLACE FUNCTION public.delete_inactive_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.profiles
  WHERE last_sign_in_at < NOW() - INTERVAL '180 days';
END;
$$;
