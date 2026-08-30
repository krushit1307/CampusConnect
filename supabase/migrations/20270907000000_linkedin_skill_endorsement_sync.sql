-- Issue #4685: Automated Event Series Skill Endorsement Sync
-- Tokens are encrypted by the Edge Function before they reach this table.

CREATE TABLE IF NOT EXISTS public.linkedin_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_person_urn TEXT NOT NULL,
  access_token_ciphertext TEXT NOT NULL,
  access_token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.linkedin_oauth_states (
  state_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.linkedin_certificate_syncs (
  certificate_id UUID PRIMARY KEY REFERENCES public.verified_certificates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  verification_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'needs_reconnect', 'unavailable', 'failed')),
  linkedin_certification_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_oauth_states_expiry ON public.linkedin_oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_linkedin_certificate_syncs_user ON public.linkedin_certificate_syncs(user_id, updated_at DESC);

ALTER TABLE public.linkedin_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_certificate_syncs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their LinkedIn connection" ON public.linkedin_connections;
CREATE POLICY "Users can view their LinkedIn connection"
  ON public.linkedin_connections FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their LinkedIn syncs" ON public.linkedin_certificate_syncs;
CREATE POLICY "Users can view their LinkedIn syncs"
  ON public.linkedin_certificate_syncs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.linkedin_connections FROM anon, authenticated;
GRANT SELECT ON public.linkedin_connections TO authenticated;
REVOKE ALL ON public.linkedin_oauth_states FROM anon, authenticated;
REVOKE ALL ON public.linkedin_certificate_syncs FROM anon, authenticated;
GRANT SELECT ON public.linkedin_certificate_syncs TO authenticated;

COMMENT ON TABLE public.linkedin_connections IS 'Encrypted per-user LinkedIn OAuth credentials; never expose access_token_ciphertext to clients.';
COMMENT ON TABLE public.linkedin_certificate_syncs IS 'Idempotent audit/status record for certificate-to-LinkedIn synchronization with a verification URL fallback.';
