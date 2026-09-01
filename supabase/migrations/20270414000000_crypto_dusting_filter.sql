-- =============================================================================
-- Issue #5281 - Crypto donation dusting-attack filter
-- Index club wallet transfers and hide dust/scam rows from the public ledger.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.crypto_scam_tokens (
  chain TEXT NOT NULL CHECK (chain IN ('ethereum', 'polygon')),
  contract_address TEXT NOT NULL,
  PRIMARY KEY (chain, contract_address)
);

CREATE TABLE IF NOT EXISTS public.crypto_donation_index (
  tx_hash TEXT PRIMARY KEY,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  chain TEXT NOT NULL CHECK (chain IN ('ethereum', 'polygon')),
  wallet_address TEXT NOT NULL,
  token_contract TEXT,
  fiat_usd NUMERIC(18, 8) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('credited', 'dropped_dust', 'dropped_scam')),
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crypto_donation_index_club
  ON public.crypto_donation_index (club_id, indexed_at DESC);

ALTER TABLE public.crypto_scam_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_donation_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read credited crypto donations" ON public.crypto_donation_index;
CREATE POLICY "Public can read credited crypto donations"
  ON public.crypto_donation_index FOR SELECT
  USING (status = 'credited');

GRANT SELECT ON public.crypto_donation_index TO anon, authenticated;
GRANT SELECT ON public.crypto_scam_tokens TO authenticated;
