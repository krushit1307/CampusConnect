-- Migration: 20260841000000_digital_swag_bag.sql
-- Description: Smart Digital Event Swag Bag delivery system with sponsor ROI analytics (#3535)

CREATE TABLE IF NOT EXISTS public.event_digital_swag (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sponsor_name TEXT NOT NULL,
  title TEXT NOT NULL,
  asset_url TEXT DEFAULT NULL,
  promo_code TEXT DEFAULT NULL,
  description TEXT DEFAULT NULL,
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.swag_bag_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent'
);

-- Indexes for fast event swag retrieval & click analytics
CREATE INDEX IF NOT EXISTS idx_event_digital_swag_event ON public.event_digital_swag(event_id);
CREATE INDEX IF NOT EXISTS idx_swag_deliveries_user_event ON public.swag_bag_deliveries(user_id, event_id);

-- Enable RLS
ALTER TABLE public.event_digital_swag ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swag_bag_deliveries ENABLE ROW LEVEL SECURITY;

-- Policies for event_digital_swag
CREATE POLICY "Public read digital swag"
ON public.event_digital_swag FOR SELECT USING (true);

CREATE POLICY "Organizers manage digital swag"
ON public.event_digital_swag FOR ALL
USING (auth.uid() IS NOT NULL);

-- Policies for swag_bag_deliveries
CREATE POLICY "Users read own swag deliveries"
ON public.swag_bag_deliveries FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System inserts swag deliveries"
ON public.swag_bag_deliveries FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

GRANT ALL ON public.event_digital_swag TO authenticated;
GRANT SELECT ON public.event_digital_swag TO anon;
GRANT ALL ON public.swag_bag_deliveries TO authenticated;
