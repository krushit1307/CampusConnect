-- =============================================================================
-- Issue #4726 - Dynamic "Multi-Campus" Shared Revenue Splitter
-- Cross-instance affiliate sharing via Stripe Connect:
--   85% host club, 10% affiliate Student Union, 5% CampusConnect platform fee.
-- PaymentIntents are tagged affiliate_source = {buyer campus instance id}.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.campus_instances (
  id TEXT PRIMARY KEY,
  institution_name TEXT NOT NULL,
  student_union_stripe_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS campus_instance_id TEXT REFERENCES public.campus_instances(id);

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS campus_instance_id TEXT REFERENCES public.campus_instances(id);

CREATE TABLE IF NOT EXISTS public.multi_campus_revenue_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id TEXT,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  host_instance_id TEXT NOT NULL,
  affiliate_instance_id TEXT NOT NULL,
  host_club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  gross_cents INTEGER NOT NULL CHECK (gross_cents >= 0),
  host_club_cents INTEGER NOT NULL CHECK (host_club_cents >= 0),
  affiliate_cents INTEGER NOT NULL CHECK (affiliate_cents >= 0),
  platform_fee_cents INTEGER NOT NULL CHECK (platform_fee_cents >= 0),
  affiliate_transfer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_multi_campus_splits_host
  ON public.multi_campus_revenue_splits (host_instance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_multi_campus_splits_affiliate
  ON public.multi_campus_revenue_splits (affiliate_instance_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_multi_campus_splits_payment_intent
  ON public.multi_campus_revenue_splits (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

ALTER TABLE public.campus_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multi_campus_revenue_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Campus instances are readable" ON public.campus_instances;
CREATE POLICY "Campus instances are readable"
  ON public.campus_instances FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Universities can view their capital flow" ON public.multi_campus_revenue_splits;
CREATE POLICY "Universities can view their capital flow"
  ON public.multi_campus_revenue_splits FOR SELECT TO authenticated
  USING (
    host_instance_id = (SELECT p.campus_instance_id FROM public.profiles p WHERE p.id = auth.uid())
    OR affiliate_instance_id = (SELECT p.campus_instance_id FROM public.profiles p WHERE p.id = auth.uid())
    OR public.is_system_admin()
  );

GRANT SELECT ON public.campus_instances TO anon, authenticated;
GRANT SELECT ON public.multi_campus_revenue_splits TO authenticated;
GRANT ALL ON public.campus_instances TO service_role;
GRANT ALL ON public.multi_campus_revenue_splits TO service_role;

CREATE OR REPLACE FUNCTION public.get_multi_campus_capital_flow(p_instance_id TEXT)
RETURNS TABLE (
  id UUID,
  payment_intent_id TEXT,
  event_id UUID,
  host_instance_id TEXT,
  affiliate_instance_id TEXT,
  gross_cents INTEGER,
  host_club_cents INTEGER,
  affiliate_cents INTEGER,
  platform_fee_cents INTEGER,
  role TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_instance_id IS NULL OR BTRIM(p_instance_id) = '' THEN
    RETURN;
  END IF;

  IF auth.role() <> 'service_role' THEN
    IF NOT (
      public.is_system_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.campus_instance_id = p_instance_id
      )
    ) THEN
      RAISE EXCEPTION 'Not allowed to view this campus capital flow.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.payment_intent_id,
    s.event_id,
    s.host_instance_id,
    s.affiliate_instance_id,
    s.gross_cents,
    s.host_club_cents,
    s.affiliate_cents,
    s.platform_fee_cents,
    CASE
      WHEN s.host_instance_id = p_instance_id AND s.affiliate_instance_id = p_instance_id THEN 'both'
      WHEN s.host_instance_id = p_instance_id THEN 'host'
      ELSE 'affiliate'
    END AS role,
    s.created_at
  FROM public.multi_campus_revenue_splits s
  WHERE s.host_instance_id = p_instance_id
     OR s.affiliate_instance_id = p_instance_id
  ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_multi_campus_capital_flow(TEXT) TO authenticated, service_role;
