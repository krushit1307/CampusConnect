-- Migration: 20260862000000_carpool_gas_cost_splitter.sql
-- Description: Dynamic Carpool Gas Cost Splitter with automated Stripe Connect micro-transfers (#4478)

CREATE TABLE IF NOT EXISTS public.carpool_gas_settlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.carpools(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_gas_cost NUMERIC(10, 2) NOT NULL,
  rider_count INT NOT NULL,
  split_amount_per_rider NUMERIC(10, 2) NOT NULL,
  stripe_transfer_id TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'settled', -- 'pending', 'settled', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.carpool_gas_split_rider_charges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  settlement_id UUID NOT NULL REFERENCES public.carpool_gas_settlements(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  charged_amount NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'transferred',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for carpool gas settlement lookups
CREATE INDEX IF NOT EXISTS idx_carpool_gas_settlements_trip ON public.carpool_gas_settlements(trip_id);

-- Enable RLS
ALTER TABLE public.carpool_gas_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpool_gas_split_rider_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read carpool gas settlements"
ON public.carpool_gas_settlements FOR SELECT
USING (true);

CREATE POLICY "Public read carpool gas split rider charges"
ON public.carpool_gas_split_rider_charges FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage carpool gas settlements"
ON public.carpool_gas_settlements FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.carpool_gas_settlements TO authenticated, anon;
GRANT ALL ON public.carpool_gas_split_rider_charges TO authenticated, anon;
