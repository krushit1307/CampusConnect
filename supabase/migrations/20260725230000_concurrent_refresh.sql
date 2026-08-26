-- Migration: 20260725230000_concurrent_refresh.sql
-- Description: Implement a high-performance concurrent Materialized View refresh strategy during off-peak hours.

-- 1. Ensure UNIQUE indexes are present on Materialized Views
-- This is a strict requirement for executing REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_stats_club_id 
ON public.club_stats (club_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_analytics_mat_view_club_id 
ON public.club_analytics_mat_view (club_id);

-- 2. Unschedule old high-frequency cron jobs and reschedule to off-peak hours (daily 2:00 AM and 2:15 AM)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    
    -- Unschedule old 15-minute refresh schedules if they exist
    BEGIN
      PERFORM cron.unschedule('refresh_club_analytics');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Old cron job refresh_club_analytics not found or could not be unscheduled.';
    END;

    BEGIN
      PERFORM cron.unschedule('refresh_club_stats_every_15min');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Old cron job refresh_club_stats_every_15min not found or could not be unscheduled.';
    END;

    -- Schedule new daily off-peak cron jobs using CONCURRENTLY
    -- Job A: refresh_club_analytics_daily_offpeak at 2:00 AM daily
    PERFORM cron.schedule(
      'refresh_club_analytics_daily_offpeak',
      '0 2 * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.club_analytics_mat_view;'
    );

    -- Job B: refresh_club_stats_daily_offpeak at 2:15 AM daily
    PERFORM cron.schedule(
      'refresh_club_stats_daily_offpeak',
      '15 2 * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.club_stats;'
    );

    RAISE NOTICE 'Successfully rescheduled Materialized View updates to daily off-peak hours.';
  ELSE
    RAISE NOTICE 'pg_cron extension not active; skipping cron rescheduling.';
  END IF;
END $$;
