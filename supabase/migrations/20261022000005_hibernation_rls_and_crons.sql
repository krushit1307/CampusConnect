-- Migration: 20261022000005_hibernation_rls_and_crons.sql
-- Description: Schedule hibernation cron job and update RLS to hide hibernating/archived clubs from public discovery

-- 1. Update RLS policy to hide non-active clubs from unauthenticated public feeds
DROP POLICY IF EXISTS "Clubs are viewable by everyone." ON public.clubs;
DROP POLICY IF EXISTS "active_clubs_only" ON public.clubs;

CREATE POLICY active_clubs_only
ON public.clubs
FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    status = 'active'
    OR auth.uid() IS NOT NULL
  )
);

-- 2. Schedule the cron job to run monthly
-- We assume the edge function `club-hibernation-check` will be served via Supabase Edge Functions.
SELECT cron.schedule(
  'club-hibernation-check',
  '0 0 1 * *', -- Run at midnight on the first day of every month
  $$
    SELECT net.http_post(
        url := 'http://functions:9000/club-hibernation-check',
        headers := '{"Content-Type": "application/json"}'::jsonb
    );
  $$
);
