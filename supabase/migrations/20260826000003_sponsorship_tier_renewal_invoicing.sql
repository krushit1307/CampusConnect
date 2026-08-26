-- Migration: 20260826000003_sponsorship_tier_renewal_invoicing.sql
-- Description: Creates schema, tables, and RPCs for Automated Sponsorship Tier Renewal Invoicing and Active Rotator Synchronization (Issue #4141)

CREATE TABLE IF NOT EXISTS public.club_sponsorship_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  tier_name TEXT NOT NULL,
  price_usd NUMERIC(10, 2) NOT NULL,
  rotator_placement_priority INT NOT NULL DEFAULT 1,
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsorship_tier_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  sponsor_name TEXT NOT NULL,
  contact_person TEXT,
  billing_email TEXT NOT NULL,
  tier_name TEXT NOT NULL DEFAULT 'Silver',
  annual_amount_usd NUMERIC(10, 2) NOT NULL DEFAULT 500.00,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiration_date TIMESTAMPTZ NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  renewal_status TEXT NOT NULL DEFAULT 'active' CHECK (
    renewal_status IN (
      'active',
      'renewal_invoiced_30d',
      'paid',
      'grace_period',
      'expired_unpaid',
      'rotator_delisted'
    )
  ),
  stripe_customer_id TEXT,
  stripe_invoice_id TEXT,
  invoice_pdf_url TEXT,
  is_active_in_rotator BOOLEAN NOT NULL DEFAULT true,
  rotator_logo_url TEXT,
  last_renewal_email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsorship_exp_status ON public.sponsorship_tier_renewals (expiration_date, renewal_status);
CREATE INDEX IF NOT EXISTS idx_sponsorship_club_id ON public.sponsorship_tier_renewals (club_id);

CREATE TABLE IF NOT EXISTS public.sponsorship_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsorship_id UUID NOT NULL REFERENCES public.sponsorship_tier_renewals(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  amount_usd NUMERIC(10, 2) NOT NULL,
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'open', 'paid', 'uncollectible', 'void')
  ),
  stripe_invoice_url TEXT,
  sent_to_email TEXT NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sponsorship_tier_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active sponsor rotator records"
  ON public.sponsorship_tier_renewals
  FOR SELECT
  USING (is_active_in_rotator = true OR auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated manage access to club renewals"
  ON public.sponsorship_tier_renewals
  FOR ALL
  USING (true);

CREATE POLICY "Allow read access to invoices"
  ON public.sponsorship_invoices
  FOR SELECT
  USING (true);

-- RPC: Cron executor for daily sponsorship renewal checks
CREATE OR REPLACE FUNCTION public.check_sponsorship_renewals_cron()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  invoices_generated INT := 0;
  rotators_delisted INT := 0;
  now_ts TIMESTAMPTZ := now();
BEGIN
  -- 1. Identify sponsorships expiring within 30 days that are still 'active'
  FOR rec IN
    SELECT id, club_id, sponsor_name, billing_email, tier_name, annual_amount_usd, expiration_date
    FROM public.sponsorship_tier_renewals
    WHERE renewal_status = 'active'
      AND expiration_date <= (now_ts + INTERVAL '30 days')
      AND expiration_date > now_ts
  LOOP
    -- Update status to renewal_invoiced_30d
    UPDATE public.sponsorship_tier_renewals
    SET renewal_status = 'renewal_invoiced_30d',
        last_renewal_email_sent_at = now_ts,
        updated_at = now_ts
    WHERE id = rec.id;

    -- Insert invoice record
    INSERT INTO public.sponsorship_invoices (
      sponsorship_id,
      club_id,
      invoice_number,
      amount_usd,
      billing_period_start,
      billing_period_end,
      status,
      sent_to_email
    ) VALUES (
      rec.id,
      rec.club_id,
      'INV-SPONSOR-' || UPPER(SUBSTRING(rec.id::text, 1, 8)) || '-' || TO_CHAR(now_ts, 'YYYY'),
      rec.annual_amount_usd,
      rec.expiration_date,
      rec.expiration_date + INTERVAL '1 year',
      'open',
      rec.billing_email
    );

    invoices_generated := invoices_generated + 1;
  END LOOP;

  -- 2. Identify sponsorships expired past expiration date that remain unpaid -> delist from rotator
  FOR rec IN
    SELECT id
    FROM public.sponsorship_tier_renewals
    WHERE (renewal_status = 'renewal_invoiced_30d' OR renewal_status = 'grace_period')
      AND expiration_date < now_ts
      AND is_active_in_rotator = true
  LOOP
    UPDATE public.sponsorship_tier_renewals
    SET renewal_status = 'rotator_delisted',
        is_active_in_rotator = false,
        updated_at = now_ts
    WHERE id = rec.id;

    rotators_delisted := rotators_delisted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'invoices_generated', invoices_generated,
    'rotators_delisted', rotators_delisted,
    'executed_at', now_ts
  );
END;
$$;
