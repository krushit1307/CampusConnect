-- Migration: 20260869000000_group_buy_avalanche.sql
-- Description: Real-Time Dynamic Pricing Group Buy Avalanche with Stripe Auth/Capture mechanics (#4893)

CREATE TABLE IF NOT EXISTS public.group_buy_avalanche_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  original_price NUMERIC(10, 2) NOT NULL DEFAULT 30.00,
  discounted_price NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
  target_commits_count INT NOT NULL DEFAULT 100,
  current_commits_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'successful', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.group_buy_avalanche_commits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.group_buy_avalanche_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_auth_hold_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'authorized', -- 'authorized', 'captured', 'released'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for group buy campaign lookups
CREATE INDEX IF NOT EXISTS idx_group_buy_campaigns_event ON public.group_buy_avalanche_campaigns(event_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_commits_campaign ON public.group_buy_avalanche_commits(campaign_id);

-- Enable RLS
ALTER TABLE public.group_buy_avalanche_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_buy_avalanche_commits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read group buy campaigns"
ON public.group_buy_avalanche_campaigns FOR SELECT
USING (true);

CREATE POLICY "Public read group buy commits"
ON public.group_buy_avalanche_commits FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage group buy campaigns"
ON public.group_buy_avalanche_campaigns FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated manage group buy commits"
ON public.group_buy_avalanche_commits FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.group_buy_avalanche_campaigns TO authenticated, anon;
GRANT ALL ON public.group_buy_avalanche_commits TO authenticated, anon;
