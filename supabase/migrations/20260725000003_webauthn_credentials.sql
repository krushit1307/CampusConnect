-- WebAuthn / Passkey Support
-- Creates tables for storing WebAuthn credentials and challenges

-- Table for storing WebAuthn challenges (ephemeral, used during registration/authentication)
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by user and type
CREATE INDEX idx_webauthn_challenges_user_type ON public.webauthn_challenges(user_id, type);
-- Index for cleanup of expired challenges
CREATE INDEX idx_webauthn_challenges_expires_at ON public.webauthn_challenges(expires_at);

-- Enable RLS
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage challenges (Edge Functions use service_role)
CREATE POLICY "Service role manages challenges"
  ON public.webauthn_challenges
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Table for storing WebAuthn credentials (passkeys)
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[] DEFAULT '{}'::TEXT[],
  device_name TEXT,
  aaguid TEXT,
  backed_up BOOLEAN DEFAULT FALSE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for credential lookup during authentication
CREATE INDEX idx_webauthn_credentials_credential_id ON public.webauthn_credentials(credential_id);
-- Index for user's credentials list
CREATE INDEX idx_webauthn_credentials_user_id ON public.webauthn_credentials(user_id);

-- Enable RLS
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- Users can read their own credentials (for management UI)
CREATE POLICY "Users can view own credentials"
  ON public.webauthn_credentials
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own credentials
CREATE POLICY "Users can delete own credentials"
  ON public.webauthn_credentials
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own credential names
CREATE POLICY "Users can update own credentials"
  ON public.webauthn_credentials
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can insert/manage all credentials (used by Edge Functions)
CREATE POLICY "Service role manages credentials"
  ON public.webauthn_credentials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Cleanup function for expired challenges (can be called by cron or manually)
CREATE OR REPLACE FUNCTION public.cleanup_expired_webauthn_challenges()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.webauthn_challenges
  WHERE expires_at < NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_webauthn_challenges() TO service_role;
