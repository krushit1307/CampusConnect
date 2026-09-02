-- Migration for Automated "Tax-Exempt" Crypto Capital Gains Calculator (DeFi Yield Donation Smart Routing) (#5307)

CREATE TABLE IF NOT EXISTS public.lossless_yield_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES public.profiles(id),
    club_id UUID NOT NULL REFERENCES public.profiles(id), -- the club org profile
    contract_address TEXT NOT NULL UNIQUE, -- Polygon address of deployed LosslessYieldDonation
    principal_locked_usdc NUMERIC DEFAULT 0,
    total_yield_harvested_usdc NUMERIC DEFAULT 0,
    apy_rate NUMERIC DEFAULT 5.0, -- Informational tracked APY
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'DEPLOYING')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-update timestamp
CREATE OR REPLACE FUNCTION set_yield_donation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lossless_yield_donations_updated_at
BEFORE UPDATE ON public.lossless_yield_donations
FOR EACH ROW
EXECUTE FUNCTION set_yield_donation_updated_at();

-- RLS
ALTER TABLE public.lossless_yield_donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donors view their active endowments" 
ON public.lossless_yield_donations 
FOR SELECT USING (donor_id = auth.uid());

CREATE POLICY "Clubs view incoming yield endowments" 
ON public.lossless_yield_donations 
FOR SELECT USING (club_id = auth.uid());
