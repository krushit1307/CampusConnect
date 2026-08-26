-- ============================================================
-- Migration: 20260726020000_cron_cleanup_orphaned_storage.sql
-- Issue: #1100
-- Description:
--   Schedules a weekly pg_cron job to trigger cleanup of orphaned
--   storage files (unreferenced avatars, banners, certificates, etc.).
-- ============================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup job to run weekly every Sunday at 00:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-orphaned-storage') THEN
    PERFORM cron.unschedule('cleanup-orphaned-storage');
  END IF;
END
$$;

SELECT cron.schedule(
  'cleanup-orphaned-storage',
  '0 0 * * 0',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM secrets.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/cleanup-orphaned-storage',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM secrets.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
