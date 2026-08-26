-- Migration: 20260812130000_push_notifications.sql
-- Adds timezone, fcm_token, and last_weekly_digest_sent_at to profiles.
-- Adds RPC to fetch eligible subscribers for the weekly digest push.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS fcm_token TEXT,
ADD COLUMN IF NOT EXISTS last_weekly_digest_sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.get_push_digest_subscribers()
RETURNS TABLE (
  id UUID,
  timezone TEXT,
  fcm_token TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.timezone, p.fcm_token
  FROM public.profiles p
  WHERE
    p.fcm_token IS NOT NULL
    -- Respect notification preferences
    AND (p.notification_preferences->>'digest')::boolean = true
    -- Ensure user hasn't received digest recently to protect against duplicates
    AND (p.last_weekly_digest_sent_at IS NULL OR p.last_weekly_digest_sent_at < (NOW() - INTERVAL '6 days'))
    -- Check local time. We convert UTC NOW() to their timezone.
    -- EXTRACT(DOW FROM ...) returns 0 for Sunday
    AND EXTRACT(DOW FROM (NOW() AT TIME ZONE p.timezone)) = 0
    -- Check if it's 18:xx local time
    AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE p.timezone)) = 18;
END;
$$;
