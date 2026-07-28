-- Migration: 20260725220000_api_rate_limiting.sql
-- Description: Implement database-level API rate-limiting and temporary blocking.

-- 1. Create table to track user block status and last request timestamps
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    last_request_timestamp TIMESTAMPTZ DEFAULT NOW(),
    blocked_until TIMESTAMPTZ DEFAULT NULL
);

-- Enable RLS on rate limits table
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow only service_role / system triggers to manage rate limits
CREATE POLICY "Service role has full access to api_rate_limits"
ON public.api_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. Create sliding-window rate limit log
CREATE TABLE IF NOT EXISTS public.api_rate_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on rate log table
ALTER TABLE public.api_rate_log ENABLE ROW LEVEL SECURITY;

-- Allow only service_role / system triggers to manage rate logs
CREATE POLICY "Service role has full access to api_rate_log"
ON public.api_rate_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Index for sliding-window lookup speed
CREATE INDEX IF NOT EXISTS idx_api_rate_log_user_time 
ON public.api_rate_log(user_id, created_at);

-- 3. Write PL/pgSQL function to verify request velocity and enforce blocking
CREATE OR REPLACE FUNCTION public.check_api_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id UUID;
  recent_count INT;
  is_blocked BOOLEAN;
  blocked_time TIMESTAMPTZ;
BEGIN
  -- Get active user ID
  current_user_id := auth.uid();

  -- If request is not authenticated, let general RLS policies manage validation
  IF current_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- A. Check if the user is currently under a block duration
  SELECT (blocked_until > NOW()), blocked_until
  INTO is_blocked, blocked_time
  FROM public.api_rate_limits
  WHERE user_id = current_user_id;

  IF is_blocked = TRUE THEN
    RAISE EXCEPTION 'Rate limit exceeded. You are temporarily blocked until %', blocked_time
      USING ERRCODE = 'RL001';
  END IF;

  -- B. Count user inserts in the last 1 minute
  SELECT COUNT(*)
  INTO recent_count
  FROM public.api_rate_log
  WHERE user_id = current_user_id
    AND created_at > NOW() - INTERVAL '1 minute';

  -- C. Block user if they exceed 20 requests per minute
  IF recent_count >= 20 THEN
    INSERT INTO public.api_rate_limits (user_id, last_request_timestamp, blocked_until)
    VALUES (current_user_id, NOW(), NOW() + INTERVAL '5 minutes')
    ON CONFLICT (user_id) DO UPDATE SET
      last_request_timestamp = EXCLUDED.last_request_timestamp,
      blocked_until = EXCLUDED.blocked_until;

    -- Clear their logs so we don't trigger multiple cascading blocks
    DELETE FROM public.api_rate_log WHERE user_id = current_user_id;

    RAISE EXCEPTION 'Rate limit exceeded. You are temporarily blocked for 5 minutes.'
      USING ERRCODE = 'RL001';
  END IF;

  -- D. Record this request and update timestamps
  INSERT INTO public.api_rate_log (user_id, created_at)
  VALUES (current_user_id, NOW());

  INSERT INTO public.api_rate_limits (user_id, last_request_timestamp, blocked_until)
  VALUES (current_user_id, NOW(), NULL)
  ON CONFLICT (user_id) DO UPDATE SET
    last_request_timestamp = EXCLUDED.last_request_timestamp,
    blocked_until = NULL;

  -- E. Prune historical entries older than 5 minutes to keep log footprint small
  DELETE FROM public.api_rate_log WHERE created_at < NOW() - INTERVAL '5 minutes';

  RETURN NEW;
END;
$$;

-- 4. Create BEFORE INSERT triggers on critical tables (posts, comments, event_rsvps)

-- A. Posts Trigger
DROP TRIGGER IF EXISTS trg_posts_rate_limit ON public.posts;
CREATE TRIGGER trg_posts_rate_limit
BEFORE INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.check_api_rate_limit();

-- B. Comments Trigger
DROP TRIGGER IF EXISTS trg_comments_rate_limit ON public.comments;
CREATE TRIGGER trg_comments_rate_limit
BEFORE INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.check_api_rate_limit();

-- C. RSVPs Trigger
DROP TRIGGER IF EXISTS trg_event_rsvps_rate_limit ON public.event_rsvps;
CREATE TRIGGER trg_event_rsvps_rate_limit
BEFORE INSERT ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.check_api_rate_limit();
