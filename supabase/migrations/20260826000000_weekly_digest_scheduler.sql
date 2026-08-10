-- Migration: 20260826000000_weekly_digest_scheduler.sql
-- Description: Implement get_weekly_digest_events SQL function and pg_cron weekly trigger.

-- 1. Create function to fetch top 5 upcoming popular events in the next 7 days
CREATE OR REPLACE FUNCTION public.get_weekly_digest_events()
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    event_date TIMESTAMPTZ,
    location TEXT,
    club_name TEXT,
    rsvp_count INT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.title,
    e.description,
    e.event_date,
    e.location,
    c.name AS club_name,
    COALESCE(COUNT(r.id), 0)::INT AS rsvp_count
  FROM public.events e
  JOIN public.clubs c ON e.club_id = c.id
  LEFT JOIN public.event_rsvps r ON e.id = r.event_id
  WHERE e.event_date >= NOW()
    AND e.event_date <= NOW() + INTERVAL '7 days'
    AND e.deleted_at IS NULL
  GROUP BY e.id, c.id, c.name
  ORDER BY rsvp_count DESC, e.event_date ASC
  LIMIT 5;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_weekly_digest_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_digest_events() TO service_role;

-- 2. Schedule pg_cron weekly trigger every Sunday at 9:00 AM
DO $$
BEGIN
    PERFORM extensions.cron.schedule('weekly-digest-scheduler', '0 9 * * 0', $$
    SELECT net.http_post(
        'http://localhost:54321/functions/v1/weekly-digest',
        '{}'::jsonb,
        '{}'::jsonb,
        jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
        )
    );
    $$);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
