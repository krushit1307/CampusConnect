-- Migration: 20260870000000_crypto_donation_slippage_alert.sql
-- Description: Real-Time Donation Goal Predictive Slippage Alert with DEX aggregator API pre-execution warning (#4983)

CREATE TABLE IF NOT EXISTS public.crypto_donation_slippage_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  token_symbol TEXT NOT NULL,
  input_amount NUMERIC(18, 6) NOT NULL,
  expected_value_usdc NUMERIC(10, 2) NOT NULL,
  actual_output_usdc NUMERIC(10, 2) NOT NULL,
  slippage_percent NUMERIC(5, 2) NOT NULL,
  slippage_loss_usdc NUMERIC(10, 2) NOT NULL,
  warning_flagged BOOLEAN DEFAULT false,
  user_acknowledged BOOLEAN DEFAULT false,
  switched_to_stablecoin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for crypto donation slippage audit lookup
CREATE INDEX IF NOT EXISTS idx_crypto_slippage_donor ON public.crypto_donation_slippage_audits(donor_id);
CREATE INDEX IF NOT EXISTS idx_crypto_slippage_club ON public.crypto_donation_slippage_audits(club_id);

-- Enable RLS
ALTER TABLE public.crypto_donation_slippage_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read crypto donation slippage audits"
ON public.crypto_donation_slippage_audits FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage crypto donation slippage audits"
ON public.crypto_donation_slippage_audits FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.crypto_donation_slippage_audits TO authenticated, anon;
