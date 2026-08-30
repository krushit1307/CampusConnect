-- Migration: 20260859000000_donation_goal_thermometer.sql
-- Description: Interactive Real-Time Donation Goal Thermometer with WebSocket ticker & Supabase RPC (#4402)

CREATE TABLE IF NOT EXISTS public.club_donation_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL DEFAULT 5000.00,
  current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.club_donations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.club_donation_campaigns(id) ON DELETE CASCADE,
  donor_name TEXT NOT NULL,
  donor_email TEXT DEFAULT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for campaign lookups
CREATE INDEX IF NOT EXISTS idx_club_donations_campaign ON public.club_donations(campaign_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.club_donation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read donation campaigns"
ON public.club_donation_campaigns FOR SELECT
USING (true);

CREATE POLICY "Public read club donations"
ON public.club_donations FOR SELECT
USING (true);

CREATE POLICY "Authenticated insert donations"
ON public.club_donations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Postgres RPC for recording campaign donation
CREATE OR REPLACE FUNCTION public.record_campaign_donation(
  p_campaign_id UUID,
  p_donor_name TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_total NUMERIC(12, 2);
  v_target NUMERIC(12, 2);
  v_pct NUMERIC(10, 2);
  v_goal_reached BOOLEAN;
BEGIN
  -- Insert donation
  INSERT INTO public.club_donations (campaign_id, donor_name, amount)
  VALUES (p_campaign_id, p_donor_name, p_amount);

  -- Update campaign total
  UPDATE public.club_donation_campaigns
  SET current_amount = current_amount + p_amount,
      updated_at = NOW()
  WHERE id = p_campaign_id
  RETURNING current_amount, target_amount INTO v_new_total, v_target;

  v_goal_reached := v_new_total >= v_target;
  IF v_target > 0 THEN
    v_pct := ROUND(((v_new_total / v_target) * 100)::numeric, 2);
  ELSE
    v_pct := 0;
  END IF;

  RETURN jsonb_build_object(
    'campaign_id', p_campaign_id,
    'current_amount', v_new_total,
    'target_amount', v_target,
    'progress_percentage', v_pct,
    'is_goal_reached', v_goal_reached
  );
END;
$$;

GRANT ALL ON public.club_donation_campaigns TO authenticated, anon;
GRANT ALL ON public.club_donations TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_campaign_donation(UUID, TEXT, NUMERIC) TO authenticated, anon;
