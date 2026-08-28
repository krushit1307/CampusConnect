-- Issue #4540: shadowban evasion detection.
-- Raw IP addresses and raw device fingerprints are never persisted.

CREATE TABLE IF NOT EXISTS public.banned_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_hash TEXT,
  device_fingerprint_hash TEXT,
  reason TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT banned_signatures_has_identifier CHECK (
    ip_hash IS NOT NULL OR device_fingerprint_hash IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS banned_signatures_ip_hash_idx
  ON public.banned_signatures(ip_hash)
  WHERE active AND ip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS banned_signatures_device_hash_idx
  ON public.banned_signatures(device_fingerprint_hash)
  WHERE active AND device_fingerprint_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS banned_signatures_source_user_idx
  ON public.banned_signatures(source_user_id, created_at DESC);

ALTER TABLE public.banned_signatures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.banned_signatures FROM anon, authenticated;
GRANT ALL ON public.banned_signatures TO service_role;

DROP POLICY IF EXISTS "banned signatures are service role only" ON public.banned_signatures;
CREATE POLICY "banned signatures are service role only"
  ON public.banned_signatures
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE public.banned_signatures IS
  'Server-secret HMAC signatures associated with shadowbanned users. Raw IP and device values are never stored.';
COMMENT ON COLUMN public.banned_signatures.ip_hash IS
  'HMAC-SHA256 of the request IP using SHADOWBAN_SIGNATURE_SECRET.';
COMMENT ON COLUMN public.banned_signatures.device_fingerprint_hash IS
  'HMAC-SHA256 of the client fingerprint using SHADOWBAN_SIGNATURE_SECRET.';
