-- ============================================================
-- Migration: 20260810000000_cron_cleanup_expired_sessions.sql
-- Issue: #923
-- Description:
--   Creates a function to clean up expired/revoked session 
--   tokens from auth.sessions, auth.refresh_tokens, and 
--   public.device_sessions. Schedules a daily pg_cron job.
-- ============================================================

-- 1. Create the cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- 1. Delete sessions that have expired
  DELETE FROM auth.sessions
  WHERE not_after < NOW();

  -- 2. Delete refresh tokens that are revoked or orphaned
  -- GoTrue usually cleans up somewhat, but we can aggressively prune them
  DELETE FROM auth.refresh_tokens
  WHERE revoked = true 
     OR (session_id IS NOT NULL AND session_id NOT IN (SELECT id FROM auth.sessions));

  -- 3. Delete application-level device sessions that are orphaned
  -- (i.e. the underlying auth session no longer exists)
  DELETE FROM public.device_sessions
  WHERE auth_session_id NOT IN (SELECT id FROM auth.sessions);
END;
$$;

-- Grant EXECUTE permission to service_role so cron can run it
REVOKE ALL ON FUNCTION public.cleanup_expired_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_sessions() FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_expired_sessions() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_sessions() TO service_role;

-- 2. Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Schedule daily cron job using pg_cron (at 3 AM every day)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-sessions') THEN
    PERFORM cron.unschedule('cleanup-expired-sessions');
  END IF;
END
$$;

SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 3 * * *',
  $$SELECT public.cleanup_expired_sessions();$$
);
