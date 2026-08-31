-- =============================================================================
-- Issue #4730 - Automated "Tax-Exempt" 1099-MISC Contractor Generator
-- Successful escrow payouts per vendor_id, W-9 bid freeze at $600, year-end
-- 1099-MISC schema mapping for the club treasurer and the vendor.
-- =============================================================================

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS tax_id_ein TEXT;

ALTER TABLE public.vendor_contracts
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_contracts_vendor_id
  ON public.vendor_contracts (vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_contracts_released_vendor
  ON public.vendor_contracts (vendor_id, released_at)
  WHERE released_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.vendor_w9_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  business_name TEXT,
  tin_type TEXT NOT NULL CHECK (tin_type IN ('ssn', 'ein')),
  tin TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vendor_w9_tin_format CHECK (
    (tin_type = 'ein' AND tin ~ '^[0-9]{2}-[0-9]{7}$')
    OR (tin_type = 'ssn' AND tin ~ '^[0-9]{3}-[0-9]{2}-[0-9]{4}$')
  )
);

CREATE TABLE IF NOT EXISTS public.vendor_1099_misc_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_year INTEGER NOT NULL,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_paid NUMERIC(12, 2) NOT NULL CHECK (total_paid >= 600),
  schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_url TEXT,
  treasurer_notified_at TIMESTAMPTZ,
  vendor_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tax_year, club_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_1099_misc_club
  ON public.vendor_1099_misc_filings (club_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_vendor_1099_misc_vendor
  ON public.vendor_1099_misc_filings (vendor_id, tax_year);

INSERT INTO storage.buckets (id, name, public)
VALUES ('tax-forms', 'tax-forms', false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.vendor_fiscal_year_escrow_total(
  p_vendor_id UUID,
  p_tax_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(vc.amount), 0)
  FROM public.vendor_contracts vc
  WHERE vc.vendor_id = p_vendor_id
    AND vc.released_at IS NOT NULL
    AND EXTRACT(YEAR FROM vc.released_at AT TIME ZONE 'UTC') = p_tax_year;
$$;

CREATE OR REPLACE FUNCTION public.club_ein(p_club_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT NULLIF(BTRIM(COALESCE(c.tax_id_ein, c.tax_id)), '')
  FROM public.clubs c
  WHERE c.id = p_club_id;
$$;

CREATE OR REPLACE FUNCTION public.is_club_treasurer(p_club_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clubs c
    WHERE c.id = p_club_id
      AND c.created_by = p_user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = p_user_id
      AND cm.status = 'approved'
      AND LOWER(cm.role::text) IN ('treasurer', 'president', 'admin', 'owner')
  );
$$;

CREATE OR REPLACE FUNCTION public.vendor_requires_w9_to_bid(
  p_tax_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.vendor_fiscal_year_escrow_total(auth.uid(), p_tax_year) >= 600
     AND NOT EXISTS (
       SELECT 1 FROM public.vendor_w9_forms w WHERE w.vendor_id = auth.uid()
     );
$$;

CREATE OR REPLACE FUNCTION public.enforce_vendor_w9_before_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_vendor_id UUID;
BEGIN
  v_vendor_id := COALESCE(NEW.vendor_user_id, auth.uid());
  IF v_vendor_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.vendor_fiscal_year_escrow_total(v_vendor_id) >= 600
     AND NOT EXISTS (
       SELECT 1 FROM public.vendor_w9_forms w WHERE w.vendor_id = v_vendor_id
     ) THEN
    RAISE EXCEPTION
      'W-9 required: Total_Paid is at least $600 for this fiscal year. Submit a digital W-9 before bidding on new gigs.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_vendor_w9_before_bid ON public.rfp_bids;
CREATE TRIGGER trg_enforce_vendor_w9_before_bid
  BEFORE INSERT ON public.rfp_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_vendor_w9_before_bid();

CREATE OR REPLACE FUNCTION public.submit_vendor_w9(
  p_legal_name TEXT,
  p_tin_type TEXT,
  p_tin TEXT,
  p_address_line1 TEXT,
  p_city TEXT,
  p_state TEXT,
  p_zip TEXT,
  p_business_name TEXT DEFAULT NULL
)
RETURNS public.vendor_w9_forms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.vendor_w9_forms;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit a W-9.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(BTRIM(p_legal_name), '') IS NULL
     OR NULLIF(BTRIM(p_tin), '') IS NULL
     OR NULLIF(BTRIM(p_address_line1), '') IS NULL
     OR NULLIF(BTRIM(p_city), '') IS NULL
     OR NULLIF(BTRIM(p_state), '') IS NULL
     OR NULLIF(BTRIM(p_zip), '') IS NULL
     OR p_tin_type NOT IN ('ssn', 'ein') THEN
    RAISE EXCEPTION 'A complete W-9 (legal name, SSN or EIN, and address) is required.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.vendor_w9_forms (
    vendor_id, legal_name, business_name, tin_type, tin,
    address_line1, city, state, zip, signed_at, updated_at
  ) VALUES (
    auth.uid(), BTRIM(p_legal_name), NULLIF(BTRIM(p_business_name), ''),
    p_tin_type, BTRIM(p_tin), BTRIM(p_address_line1), BTRIM(p_city),
    BTRIM(p_state), BTRIM(p_zip), NOW(), NOW()
  )
  ON CONFLICT (vendor_id) DO UPDATE SET
    legal_name = EXCLUDED.legal_name,
    business_name = EXCLUDED.business_name,
    tin_type = EXCLUDED.tin_type,
    tin = EXCLUDED.tin,
    address_line1 = EXCLUDED.address_line1,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zip = EXCLUDED.zip,
    signed_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_vendor_1099_misc_filings(
  p_tax_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - 1,
  p_club_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF p_club_id IS NULL OR NOT public.is_club_treasurer(p_club_id, auth.uid()) THEN
      RAISE EXCEPTION 'Only a club treasurer can prepare 1099-MISC filings.' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.vendor_1099_misc_filings (
    tax_year, club_id, vendor_id, total_paid, schema
  )
  SELECT
    p_tax_year,
    totals.club_id,
    totals.vendor_id,
    totals.total_paid,
    jsonb_build_object(
      'form', '1099-MISC',
      'tax_year', p_tax_year,
      'payer_name', c.name,
      'payer_tin', COALESCE(NULLIF(BTRIM(c.tax_id_ein), ''), NULLIF(BTRIM(c.tax_id), '')),
      'recipient_name', COALESCE(NULLIF(BTRIM(w.business_name), ''), w.legal_name),
      'recipient_tin', w.tin,
      'recipient_tin_type', w.tin_type,
      'recipient_address', w.address_line1 || ', ' || w.city || ', ' || w.state || ' ' || w.zip,
      'box_3_other_income', totals.total_paid
    )
  FROM (
    SELECT vc.club_id, vc.vendor_id, SUM(vc.amount)::NUMERIC(12, 2) AS total_paid
    FROM public.vendor_contracts vc
    WHERE vc.vendor_id IS NOT NULL
      AND vc.released_at IS NOT NULL
      AND EXTRACT(YEAR FROM vc.released_at AT TIME ZONE 'UTC') = p_tax_year
      AND (p_club_id IS NULL OR vc.club_id = p_club_id)
    GROUP BY vc.club_id, vc.vendor_id
    HAVING SUM(vc.amount) >= 600
  ) totals
  JOIN public.clubs c ON c.id = totals.club_id
  JOIN public.vendor_w9_forms w ON w.vendor_id = totals.vendor_id
  WHERE COALESCE(NULLIF(BTRIM(c.tax_id_ein), ''), NULLIF(BTRIM(c.tax_id), '')) IS NOT NULL
  ON CONFLICT (tax_year, club_id, vendor_id) DO UPDATE SET
    total_paid = EXCLUDED.total_paid,
    schema = EXCLUDED.schema
  WHERE public.vendor_1099_misc_filings.pdf_url IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoke_vendor_1099_misc_year_end()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_payload JSONB;
BEGIN
  PERFORM public.prepare_vendor_1099_misc_filings(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - 1, NULL);

  v_url := rtrim(COALESCE(current_setting('app.settings.supabase_url', true), ''), '/')
    || '/functions/v1/generate-1099-misc';
  IF v_url = '/functions/v1/generate-1099-misc' THEN
    RETURN;
  END IF;

  v_payload := jsonb_build_object(
    'taxYear', EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - 1
  );

  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'http_post' AND n.nspname = 'net'
    ) THEN
      PERFORM net.http_post(
        url := v_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := v_payload
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'prepare-vendor-1099-misc',
    '0 6 2 1 *',
    'SELECT public.invoke_vendor_1099_misc_year_end();'
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE public.vendor_w9_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_1099_misc_filings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage own W-9" ON public.vendor_w9_forms;
CREATE POLICY "Vendors manage own W-9"
  ON public.vendor_w9_forms FOR ALL TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

DROP POLICY IF EXISTS "Treasurers read W-9 of paid vendors" ON public.vendor_w9_forms;
CREATE POLICY "Treasurers read W-9 of paid vendors"
  ON public.vendor_w9_forms FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendor_contracts vc
      WHERE vc.vendor_id = vendor_w9_forms.vendor_id
        AND vc.released_at IS NOT NULL
        AND public.is_club_treasurer(vc.club_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Vendors read own 1099-MISC" ON public.vendor_1099_misc_filings;
CREATE POLICY "Vendors read own 1099-MISC"
  ON public.vendor_1099_misc_filings FOR SELECT TO authenticated
  USING (vendor_id = auth.uid());

DROP POLICY IF EXISTS "Treasurers read club 1099-MISC" ON public.vendor_1099_misc_filings;
CREATE POLICY "Treasurers read club 1099-MISC"
  ON public.vendor_1099_misc_filings FOR SELECT TO authenticated
  USING (public.is_club_treasurer(club_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.vendor_w9_forms TO authenticated;
GRANT SELECT ON public.vendor_1099_misc_filings TO authenticated;
GRANT ALL ON public.vendor_w9_forms TO service_role;
GRANT ALL ON public.vendor_1099_misc_filings TO service_role;
GRANT EXECUTE ON FUNCTION public.vendor_fiscal_year_escrow_total(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_requires_w9_to_bid(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_vendor_w9(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_vendor_1099_misc_filings(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_treasurer(UUID, UUID) TO authenticated;

COMMENT ON TABLE public.vendor_w9_forms IS
  'Digital W-9 (SSN/EIN) collected before a vendor paid >= $600 may bid on new gigs (#4730).';
COMMENT ON TABLE public.vendor_1099_misc_filings IS
  'Year-end IRS 1099-MISC schema rows for club treasurers and vendors (#4730).';
COMMENT ON FUNCTION public.vendor_fiscal_year_escrow_total IS
  'Sum of successful escrow payouts (released_at) per vendor_id for a calendar tax year.';
