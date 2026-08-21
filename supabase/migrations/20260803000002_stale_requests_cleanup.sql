-- Enable pg_cron extension if not already enabled (Supabase has this built-in but good to make sure)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule if it already exists to keep the migration idempotent
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-stale-club-requests');
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not fully initialized, or job doesn't exist, ignore
END $$;

-- Schedule the cleanup to run daily at midnight
SELECT cron.schedule(
  'cleanup-stale-club-requests',
  '0 0 * * *',
  $$
    DELETE FROM public.club_members
    WHERE status = 'pending'
      AND joined_at < NOW() - INTERVAL '30 days';
  $$
);
