-- ============================================================
-- Migration: 20260722070000_cron_complete_events.sql
-- Issue: #589
-- Description:
--   Creates the public.auto_complete_past_events() function
--   and schedules an hourly pg_cron job to automatically mark
--   past events (where event date has passed) as 'completed'.
-- ============================================================

-- 1. Create function auto_complete_past_events()
CREATE OR REPLACE FUNCTION public.auto_complete_past_events()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.events
  SET status = 'completed',
      updated_at = NOW()
  WHERE status = 'scheduled'
    AND COALESCE(end_date, start_date, event_date) < NOW();
END;
$$;

-- Grant EXECUTE permission to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.auto_complete_past_events() TO authenticated, service_role;

-- 2. Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Schedule hourly cron job using pg_cron (at minute 0 of every hour)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-complete-past-events') THEN
    PERFORM cron.unschedule('auto-complete-past-events');
  END IF;
END
$$;

SELECT cron.schedule(
  'auto-complete-past-events',
  '0 * * * *',
  $$SELECT public.auto_complete_past_events();$$
);
