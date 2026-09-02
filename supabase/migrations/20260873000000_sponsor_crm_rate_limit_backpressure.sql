-- Migration: 20260873000000_sponsor_crm_rate_limit_backpressure.sql
-- Description: Real-Time Sponsor Lead CRM Webhook Rate Limit Backpressure with dynamic HTTP 429 parsing & SQS consumer throttling (#5061)

CREATE TABLE IF NOT EXISTS public.sponsor_crm_backpressure_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sponsor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  crm_target_url TEXT NOT NULL,
  is_paused BOOLEAN DEFAULT false,
  retry_after_seconds INT DEFAULT 60,
  paused_until TIMESTAMPTZ DEFAULT NULL,
  throttled_rate_per_sec INT DEFAULT 5,
  http_429_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for backpressure lookup
CREATE INDEX IF NOT EXISTS idx_sponsor_crm_backpressure_sponsor ON public.sponsor_crm_backpressure_states(sponsor_id);

-- Enable RLS
ALTER TABLE public.sponsor_crm_backpressure_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read sponsor crm backpressure states"
ON public.sponsor_crm_backpressure_states FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage sponsor crm backpressure states"
ON public.sponsor_crm_backpressure_states FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.sponsor_crm_backpressure_states TO authenticated, anon;
