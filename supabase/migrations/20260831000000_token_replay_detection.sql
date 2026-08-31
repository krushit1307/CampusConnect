-- ============================================================
-- Migration: 20260831000000_token_replay_detection.sql
-- Description: Binds each authenticated device session to the
--              fingerprint + IP subnet that minted it, and adds an
--              RPC that detects token replay (the same JWT presented
--              from a different device/network).
--
-- Design notes:
--   * Raw fingerprints and raw IP addresses are NEVER persisted.
--     Only HMAC-SHA256 digests (keyed with a server secret) are
--     stored, mirroring the existing `banned_signatures` pattern.
--   * The check is fail-open: sessions minted before this migration,
--     or requests without fingerprint/subnet data, are not blocked.
--     A confirmed replay (both dimensions available and both differ)
--     revokes the underlying auth session and reports the anomaly.
-- ============================================================

-- 1. Binding columns on public.device_sessions ---------------------
ALTER TABLE public.device_sessions
  ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT,
  ADD COLUMN IF NOT EXISTS ip_subnet_hash TEXT;

COMMENT ON COLUMN public.device_sessions.fingerprint_hash IS
  'HMAC-SHA256 of the browser fingerprint that minted this session (REPLAY_BINDING_SECRET). Raw fingerprint is never stored.';
COMMENT ON COLUMN public.device_sessions.ip_subnet_hash IS
  'HMAC-SHA256 of the /24 IP subnet that minted this session (REPLAY_BINDING_SECRET). Raw IP is never stored.';

-- 2. Replay detection RPC ------------------------------------------
-- Compares a request's fingerprint + IP subnet against the binding
-- recorded when the session was minted. Returns a verdict:
--   'ok'            -> data matches (or check cannot be performed)
--   'replay'        -> confirmed context mismatch: revoke the session
CREATE OR REPLACE FUNCTION public.detect_session_replay(
  p_auth_session_id UUID,
  p_fingerprint_hash TEXT,
  p_ip_subnet_hash TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bound_fingerprint TEXT;
  v_bound_subnet TEXT;
BEGIN
  -- Fail open when there is nothing to compare against.
  IF p_fingerprint_hash IS NULL OR p_ip_subnet_hash IS NULL THEN
    RETURN 'ok';
  END IF;

  SELECT fingerprint_hash, ip_subnet_hash
    INTO v_bound_fingerprint, v_bound_subnet
    FROM public.device_sessions
   WHERE auth_session_id = p_auth_session_id;

  -- No binding row (session minted before this feature shipped, or
  -- registration has not completed yet) -> fail open.
  IF v_bound_fingerprint IS NULL OR v_bound_subnet IS NULL THEN
    RETURN 'ok';
  END IF;

  -- Confirmed replay: the token is being presented from a context
  -- that differs from the one that minted it. Revoke the underlying
  -- auth session so the stolen token (and its refresh token) die,
  -- then report the anomaly so the caller can force a global logout.
  IF v_bound_fingerprint <> p_fingerprint_hash
     AND v_bound_subnet <> p_ip_subnet_hash THEN
    PERFORM public.revoke_auth_session(p_auth_session_id);
    RETURN 'replay';
  END IF;

  RETURN 'ok';
END;
$$;

-- 3. Service role only ----------------------------------------------
REVOKE ALL ON FUNCTION public.detect_session_replay(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_session_replay(UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.detect_session_replay(UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.detect_session_replay(UUID, TEXT, TEXT) TO service_role;
