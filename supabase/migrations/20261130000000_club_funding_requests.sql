-- Issue #3446: Club Budget Request Workflow
-- Itemized funding requests are reviewed by Student Union staff and credited
-- to the club ledger exactly once when approved.

CREATE TABLE IF NOT EXISTS public.funding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'denied')),
  review_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.funding_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.funding_requests(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (char_length(btrim(description)) BETWEEN 2 AND 240),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  quote_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funding_requests_club_status
  ON public.funding_requests (club_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funding_line_items_request
  ON public.funding_line_items (request_id);

-- The existing club ledger is the reconciliation target. A unique request ID
-- makes approval idempotent even if a client retries the RPC.
ALTER TABLE public.club_transactions
  ADD COLUMN IF NOT EXISTS funding_request_id UUID
  REFERENCES public.funding_requests(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_transactions_funding_request
  ON public.club_transactions (funding_request_id)
  WHERE funding_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_funding_reviewer(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND (
        COALESCE(p.is_admin, FALSE)
        OR p.role::TEXT IN ('admin', 'safety_admin', 'system_admin')
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    JOIN public.clubs c ON c.id = cm.club_id
    LEFT JOIN public.club_roles cr ON cr.id = cm.role_id
    WHERE cm.user_id = p_user_id
      AND cm.status = 'approved'
      AND (
        cm.role::TEXT IN ('admin', 'owner', 'president')
        OR COALESCE(cr.permissions_level, 0) >= 100
      )
      AND LOWER(c.name) = 'student union'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_funding_treasurer(
  p_club_id UUID,
  p_user_id UUID
)
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
  )
  OR EXISTS (
    SELECT 1
    FROM public.club_members cm
    LEFT JOIN public.club_roles cr ON cr.id = cm.role_id
    WHERE cm.club_id = p_club_id
      AND cm.user_id = p_user_id
      AND cm.status = 'approved'
      AND (
        cm.role::TEXT IN ('admin', 'owner', 'president', 'treasurer', 'officer')
        OR COALESCE(cr.permissions_level, 0) >= 100
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_funding_reviewer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_funding_treasurer(UUID, UUID) TO authenticated;

ALTER TABLE public.funding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Funding requests are visible to club members and reviewers" ON public.funding_requests;
CREATE POLICY "Funding requests are visible to club members and reviewers"
  ON public.funding_requests FOR SELECT TO authenticated
  USING (
    public.is_funding_reviewer(auth.uid())
    OR public.is_funding_treasurer(club_id, auth.uid())
  );

DROP POLICY IF EXISTS "Funding line items are visible to club members and reviewers" ON public.funding_line_items;
CREATE POLICY "Funding line items are visible to club members and reviewers"
  ON public.funding_line_items FOR SELECT TO authenticated
  USING (
    public.is_funding_reviewer(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.funding_requests fr
      WHERE fr.id = funding_line_items.request_id
        AND public.is_funding_treasurer(fr.club_id, auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.submit_funding_request(
  p_club_id UUID,
  p_title TEXT,
  p_line_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
  v_item JSONB;
  v_amount NUMERIC(12, 2);
  v_total NUMERIC(12, 2) := 0;
BEGIN
  IF NOT public.is_funding_treasurer(p_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only an approved club treasurer or club administrator can submit funding requests.' USING ERRCODE = '42501';
  END IF;

  IF char_length(btrim(COALESCE(p_title, ''))) < 3 THEN
    RAISE EXCEPTION 'A funding request title is required.' USING ERRCODE = '22023';
  END IF;

  IF p_line_items IS NULL OR jsonb_typeof(p_line_items) <> 'array' OR jsonb_array_length(p_line_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one funding line item.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    IF char_length(btrim(COALESCE(v_item->>'description', ''))) < 2 THEN
      RAISE EXCEPTION 'Every funding line item needs a description.' USING ERRCODE = '22023';
    END IF;

    v_amount := (v_item->>'amount')::NUMERIC(12, 2);
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Every funding line item must have a positive amount.' USING ERRCODE = '22023';
    END IF;

    v_total := v_total + v_amount;
  END LOOP;

  INSERT INTO public.funding_requests (club_id, requested_by, title, total_amount)
  VALUES (p_club_id, auth.uid(), btrim(p_title), v_total)
  RETURNING id INTO v_request_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    INSERT INTO public.funding_line_items (request_id, description, amount, quote_url)
    VALUES (
      v_request_id,
      btrim(v_item->>'description'),
      (v_item->>'amount')::NUMERIC(12, 2),
      NULLIF(btrim(v_item->>'quote_url'), '')
    );
  END LOOP;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_funding_request(UUID, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_funding_request_status(
  p_request_id UUID,
  p_status TEXT,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.funding_requests;
  v_previous_status TEXT;
  v_ledger_id UUID;
BEGIN
  IF NOT public.is_funding_reviewer(auth.uid()) THEN
    RAISE EXCEPTION 'Only Student Union reviewers can update funding requests.' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('under_review', 'approved', 'denied') THEN
    RAISE EXCEPTION 'Status must be under_review, approved, or denied.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_request
  FROM public.funding_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Funding request not found.' USING ERRCODE = 'P0002';
  END IF;

  v_previous_status := v_request.status;

  IF v_previous_status IN ('approved', 'denied') THEN
    RAISE EXCEPTION 'This funding request has already been finalized.' USING ERRCODE = '55000';
  END IF;

  IF p_status = 'approved' THEN
    UPDATE public.funding_requests
    SET status = 'approved',
        review_notes = NULLIF(btrim(p_review_notes), ''),
        reviewed_by = auth.uid(),
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;

    INSERT INTO public.club_transactions (
      club_id,
      amount,
      transaction_type,
      category,
      description,
      funding_request_id
    )
    VALUES (
      v_request.club_id,
      v_request.total_amount,
      'INCOME',
      'Student Union Grant',
      'Approved funding request: ' || v_request.title,
      v_request.id
    )
    ON CONFLICT (funding_request_id) DO NOTHING
    RETURNING id INTO v_ledger_id;
  ELSE
    UPDATE public.funding_requests
    SET status = p_status,
        review_notes = NULLIF(btrim(p_review_notes), ''),
        reviewed_by = CASE WHEN p_status = 'denied' THEN auth.uid() ELSE reviewed_by END,
        reviewed_at = CASE WHEN p_status = 'denied' THEN NOW() ELSE reviewed_at END,
        updated_at = NOW()
    WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'request_id', p_request_id,
    'status', p_status,
    'ledger_reconciled', p_status = 'approved'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_funding_request_status(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON TABLE public.funding_requests IS
  'Itemized club funding requests submitted to the Student Union. Issue #3446.';
COMMENT ON TABLE public.funding_line_items IS
  'Line items and optional quote links for funding requests. Issue #3446.';
