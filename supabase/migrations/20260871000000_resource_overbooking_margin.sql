-- Migration: 20260871000000_resource_overbooking_margin.sql
-- Description: Dynamic Resource Constraint Overbooking Margin Algorithm with standby queue auto-promotion (#4984)

CREATE TABLE IF NOT EXISTS public.resource_overbooking_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_category TEXT NOT NULL UNIQUE,
  historical_no_show_rate NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
  max_overbooking_capacity_percent INT NOT NULL DEFAULT 110,
  no_show_grace_period_minutes INT NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.resource_standby_queues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id TEXT NOT NULL,
  primary_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  primary_club_name TEXT NOT NULL,
  standby_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  standby_club_name TEXT NOT NULL,
  reservation_start_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'standby', -- 'standby', 'promoted', 'expired'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for standby queue lookups
CREATE INDEX IF NOT EXISTS idx_resource_standby_asset ON public.resource_standby_queues(asset_id, status);

-- Enable RLS
ALTER TABLE public.resource_overbooking_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_standby_queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read resource overbooking configs"
ON public.resource_overbooking_configs FOR SELECT
USING (true);

CREATE POLICY "Public read resource standby queues"
ON public.resource_standby_queues FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage resource overbooking configs"
ON public.resource_overbooking_configs FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated manage resource standby queues"
ON public.resource_standby_queues FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.resource_overbooking_configs TO authenticated, anon;
GRANT ALL ON public.resource_standby_queues TO authenticated, anon;
