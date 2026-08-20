-- Migration: 20260843000000_api_webhook_subscriptions.sql
-- Description: Developer Webhook Subscriptions Portal with HMAC SHA-256 signing (#3543)

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  endpoint_url TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_delivery_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER DEFAULT NULL,
  response_body TEXT DEFAULT NULL,
  success BOOLEAN DEFAULT false,
  attempt INTEGER DEFAULT 1,
  delivered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast webhook dispatch queries
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_club ON public.webhook_endpoints(club_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_endpoint ON public.webhook_subscriptions(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_endpoint ON public.webhook_delivery_logs(endpoint_id);

-- Enable RLS
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Policies for club leaders & developers
CREATE POLICY "Club leaders manage webhook endpoints"
ON public.webhook_endpoints FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Club leaders manage subscriptions"
ON public.webhook_subscriptions FOR ALL
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Club leaders view delivery logs"
ON public.webhook_delivery_logs FOR SELECT
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_subscriptions TO authenticated;
GRANT ALL ON public.webhook_delivery_logs TO authenticated;
