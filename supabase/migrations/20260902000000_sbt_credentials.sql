-- Migration for Dynamic "Alumni Speaker" Engagement Tokenomics (SBTs) (#4987)

-- 1. Add Web3 Wallet Address to Profiles so students can link their Polygon wallets
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS web3_wallet_address TEXT UNIQUE;

-- 2. Table to define High-Value Seminar Series
CREATE TABLE IF NOT EXISTS public.alumni_seminar_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    alumni_speaker_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    required_events_count INTEGER NOT NULL CHECK (required_events_count > 0),
    polygon_token_id INTEGER UNIQUE, -- The ID on the smart contract
    ipfs_metadata_uri TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Mapping Events to a Seminar Series
CREATE TABLE IF NOT EXISTS public.alumni_seminar_events (
    series_id UUID NOT NULL REFERENCES public.alumni_seminar_series(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    PRIMARY KEY (series_id, event_id)
);

-- 4. Ledger of Minted SBTs
CREATE TABLE IF NOT EXISTS public.sbt_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES public.alumni_seminar_series(id) ON DELETE CASCADE,
    polygon_tx_hash TEXT NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, series_id)
);

-- RLS
ALTER TABLE public.alumni_seminar_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumni_seminar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbt_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view seminar series" ON public.alumni_seminar_series FOR SELECT USING (true);
CREATE POLICY "Anyone can view seminar events" ON public.alumni_seminar_events FOR SELECT USING (true);
CREATE POLICY "Students can view their own SBTs" ON public.sbt_credentials FOR SELECT USING (true); -- Publicly verifiable

