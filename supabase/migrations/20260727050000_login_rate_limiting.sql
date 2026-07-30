-- Tracks every login attempt (success or failure) so we can detect
-- brute-force / credential-stuffing patterns per email and per IP address.
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time
ON login_attempts(email, attempted_at);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time
ON login_attempts(ip_address, attempted_at);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Only our Edge Function (using the service role key) is allowed to
-- read/write this table. No regular user should be able to see or
-- tamper with the lockout history.
DROP POLICY IF EXISTS "Allow backend to manage login attempts" ON login_attempts;
CREATE POLICY "Allow backend to manage login attempts"
ON login_attempts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- The password_reset_requests table already existed but had no RLS policy,
-- meaning it wasn't actually protected. Lock it down the same way.
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow backend to manage password reset requests" ON password_reset_requests;
CREATE POLICY "Allow backend to manage password reset requests"
ON password_reset_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Returns whether this email OR this IP address is currently locked out.
-- An account/IP is locked once it has 5+ failed login attempts within the
-- trailing 15 minutes, and stays locked until those failures age past the
-- 15 minute window (i.e. roughly a 15 minute cooldown).
CREATE OR REPLACE FUNCTION public.check_login_lockout(p_email TEXT, p_ip TEXT)
RETURNS TABLE(is_locked BOOLEAN, retry_after_seconds INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fail_count INT;
  v_oldest_fail TIMESTAMPTZ;
BEGIN
  SELECT COUNT(*), MIN(attempted_at)
  INTO v_fail_count, v_oldest_fail
  FROM login_attempts
  WHERE (email = p_email OR ip_address = p_ip)
    AND success = false
    AND attempted_at > NOW() - INTERVAL '15 minutes';

  IF v_fail_count >= 5 THEN
    RETURN QUERY SELECT
      true,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_oldest_fail + INTERVAL '15 minutes' - NOW()))))::INT;
  ELSE
    RETURN QUERY SELECT false, 0;
  END IF;
END;
$$;

-- Clears failed-attempt history for an email once they log in successfully,
-- so a legitimate user isn't penalized by their own earlier typos.
CREATE OR REPLACE FUNCTION public.clear_login_attempts(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM login_attempts
  WHERE email = p_email AND success = false;
END;
$$;

-- Returns whether a password reset email was already requested for this
-- address within the last hour (throttled to 1 per hour).
CREATE OR REPLACE FUNCTION public.check_password_reset_throttle(p_email TEXT)
RETURNS TABLE(is_throttled BOOLEAN, retry_after_seconds INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_request TIMESTAMPTZ;
BEGIN
  SELECT MAX(requested_at) INTO v_last_request
  FROM password_reset_requests
  WHERE email = p_email
    AND requested_at > NOW() - INTERVAL '1 hour';

  IF v_last_request IS NOT NULL THEN
    RETURN QUERY SELECT
      true,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_last_request + INTERVAL '1 hour' - NOW()))))::INT;
  ELSE
    RETURN QUERY SELECT false, 0;
  END IF;
END;
$$;