-- Issue #4038: Dynamic ticket-scalping prevention.
-- Raw IP and device identifiers are never persisted; only server-secret HMACs are stored.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_high_demand BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.ticket_claim_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  device_fingerprint_hash TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_claim_attempts_created_at_idx
  ON public.ticket_claim_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_claim_attempts_user_created_at_idx
  ON public.ticket_claim_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_claim_attempts_ip_created_at_idx
  ON public.ticket_claim_attempts (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_claim_attempts_device_created_at_idx
  ON public.ticket_claim_attempts (device_fingerprint_hash, created_at DESC)
  WHERE device_fingerprint_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ticket_claim_attempts_idempotency_key_idx
  ON public.ticket_claim_attempts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.ticket_claim_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket claim attempts are service role only" ON public.ticket_claim_attempts;
CREATE POLICY "ticket claim attempts are service role only"
  ON public.ticket_claim_attempts
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

REVOKE ALL ON public.ticket_claim_attempts FROM anon, authenticated;
GRANT ALL ON public.ticket_claim_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_ticket_claim_rate_limit(
  p_event_id UUID,
  p_user_id UUID,
  p_ip_address TEXT,
  p_device_fingerprint TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_hash_secret TEXT DEFAULT NULL,
  p_window_seconds INTEGER DEFAULT 60,
  p_max_claims INTEGER DEFAULT 2
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip_hash TEXT;
  v_device_hash TEXT;
  v_recent_count INTEGER;
  v_retry_after INTEGER;
  v_existing_id UUID;
BEGIN
  IF p_event_id IS NULL OR p_user_id IS NULL OR NULLIF(TRIM(p_ip_address), '') IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'code', 'INVALID_CLAIM_CONTEXT',
      'message', 'A valid claim context is required.'
    );
  END IF;

  IF p_window_seconds NOT BETWEEN 10 AND 300 OR p_max_claims NOT BETWEEN 1 AND 10 THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'code', 'INVALID_RATE_LIMIT_CONFIG',
      'message', 'Invalid claim-rate configuration.'
    );
  END IF;

  IF p_hash_secret IS NULL OR LENGTH(p_hash_secret) < 16 THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'code', 'CLAIM_HASH_NOT_CONFIGURED',
      'message', 'Ticket claim protection is temporarily unavailable.'
    );
  END IF;

  -- Keep the pseudonymous ledger short-lived; cleanup runs opportunistically on claims.
  DELETE FROM public.ticket_claim_attempts
   WHERE created_at < NOW() - INTERVAL '1 day';

  v_ip_hash := encode(hmac(TRIM(p_ip_address), p_hash_secret, 'sha256'), 'hex');
  v_device_hash := CASE
    WHEN NULLIF(TRIM(COALESCE(p_device_fingerprint, '')), '') IS NULL THEN NULL
    ELSE encode(hmac(TRIM(p_device_fingerprint), p_hash_secret, 'sha256'), 'hex')
  END;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id
      INTO v_existing_id
      FROM public.ticket_claim_attempts
     WHERE idempotency_key = p_idempotency_key
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'allowed', TRUE,
        'code', 'IDEMPOTENT_REPLAY',
        'claim_id', v_existing_id
      );
    END IF;
  END IF;

  -- Serialize each identity dimension so concurrent requests cannot pass the
  -- count check together and exceed the two-claims-per-minute threshold.
  PERFORM pg_advisory_xact_lock(hashtextextended('ticket-user:' || p_user_id::TEXT, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('ticket-ip:' || v_ip_hash, 0));
  IF v_device_hash IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('ticket-device:' || v_device_hash, 0));
  END IF;

  SELECT COUNT(*)::INTEGER
    INTO v_recent_count
    FROM public.ticket_claim_attempts
   WHERE created_at >= NOW() - make_interval(secs => p_window_seconds)
     AND (
       user_id = p_user_id
       OR ip_hash = v_ip_hash
       OR (v_device_hash IS NOT NULL AND device_fingerprint_hash = v_device_hash)
     );

  IF v_recent_count >= p_max_claims THEN
    SELECT GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (
        MIN(created_at) + make_interval(secs => p_window_seconds) - NOW()
      )))::INTEGER
    )
      INTO v_retry_after
      FROM public.ticket_claim_attempts
     WHERE created_at >= NOW() - make_interval(secs => p_window_seconds)
       AND (
         user_id = p_user_id
         OR ip_hash = v_ip_hash
         OR (v_device_hash IS NOT NULL AND device_fingerprint_hash = v_device_hash)
       );

    RETURN jsonb_build_object(
      'allowed', FALSE,
      'code', 'TICKET_CLAIM_RATE_LIMITED',
      'message', 'Too many ticket claims in a short period. Please try again shortly.',
      'retry_after_seconds', COALESCE(v_retry_after, p_window_seconds)
    );
  END IF;

  INSERT INTO public.ticket_claim_attempts (
    event_id,
    user_id,
    ip_hash,
    device_fingerprint_hash,
    idempotency_key
  )
  VALUES (p_event_id, p_user_id, v_ip_hash, v_device_hash, p_idempotency_key)
  RETURNING id INTO v_existing_id;

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'code', 'TICKET_CLAIM_RECORDED',
    'claim_id', v_existing_id,
    'remaining_claims', GREATEST(0, p_max_claims - v_recent_count - 1)
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id
      INTO v_existing_id
      FROM public.ticket_claim_attempts
     WHERE idempotency_key = p_idempotency_key
     LIMIT 1;

    RETURN jsonb_build_object(
      'allowed', TRUE,
      'code', 'IDEMPOTENT_REPLAY',
      'claim_id', v_existing_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_ticket_claim_rate_limit(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER)
  TO service_role;

COMMENT ON TABLE public.ticket_claim_attempts IS
  'Short-lived HMAC-based anti-scalping claim ledger. Raw IP/device identifiers are never stored.';
COMMENT ON FUNCTION public.enforce_ticket_claim_rate_limit(UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) IS
  'Atomically records a ticket claim attempt and blocks the third matching user/IP/device claim within 60 seconds.';

-- The canonical RSVP mutator is now reachable only through the authenticated
-- Edge Function, which supplies auth, CAPTCHA, IP, and device signals.
REVOKE EXECUTE ON FUNCTION public.join_event_or_waitlist(UUID, UUID, BOOLEAN, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_event_or_waitlist(UUID, UUID, BOOLEAN, TEXT, UUID)
  TO service_role;
