-- Issue #4032: Dynamic Event Co-Sponsorship Portal.
-- Every monetary movement is represented by an immutable club transaction and a
-- matching escrow entry. Approval and cancellation refunds are transaction-safe.

ALTER TABLE public.club_transactions
  ADD COLUMN IF NOT EXISTS co_sponsor_id UUID;


CREATE UNIQUE INDEX IF NOT EXISTS idx_club_transactions_co_sponsor_debit
  ON public.club_transactions (co_sponsor_id)
  WHERE co_sponsor_id IS NOT NULL AND transaction_type = 'EXPENSE';

CREATE TABLE IF NOT EXISTS public.co_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  contribution_amount NUMERIC(12, 2) NOT NULL CHECK (contribution_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, club_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'club_transactions_co_sponsor_id_fkey'
      AND conrelid = 'public.club_transactions'::regclass
  ) THEN
    ALTER TABLE public.club_transactions
      ADD CONSTRAINT club_transactions_co_sponsor_id_fkey
      FOREIGN KEY (co_sponsor_id) REFERENCES public.co_sponsors(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.event_escrow_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  co_sponsor_id UUID NOT NULL REFERENCES public.co_sponsors(id) ON DELETE RESTRICT,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount <> 0),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('deposit', 'refund')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (co_sponsor_id, entry_type)
);

CREATE INDEX IF NOT EXISTS idx_co_sponsors_event_status
  ON public.co_sponsors (event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_co_sponsors_club_status
  ON public.co_sponsors (club_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_escrow_ledger_event
  ON public.event_escrow_ledger (event_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_co_sponsors_updated_at ON public.co_sponsors;
CREATE TRIGGER trg_co_sponsors_updated_at
  BEFORE UPDATE ON public.co_sponsors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.co_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_escrow_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Co-sponsors visible to event and club admins" ON public.co_sponsors;
CREATE POLICY "Co-sponsors visible to event and club admins"
  ON public.co_sponsors FOR SELECT TO authenticated
  USING (
    public.is_event_admin(event_id, auth.uid())
    OR public.is_club_admin_check(club_id, auth.uid())
  );

DROP POLICY IF EXISTS "Co-sponsor requests use the approval RPC" ON public.co_sponsors;

REVOKE INSERT, UPDATE, DELETE ON public.co_sponsors FROM anon, authenticated;
GRANT SELECT ON public.co_sponsors TO authenticated;

DROP POLICY IF EXISTS "Escrow visible to authorized finance users" ON public.event_escrow_ledger;
CREATE POLICY "Escrow visible to authorized finance users"
  ON public.event_escrow_ledger FOR SELECT TO authenticated
  USING (
    public.is_event_admin(event_id, auth.uid())
    OR public.is_club_admin_check(club_id, auth.uid())
  );

REVOKE ALL ON public.event_escrow_ledger FROM anon, authenticated;
GRANT SELECT ON public.event_escrow_ledger TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.event_escrow_ledger FROM anon, authenticated;
GRANT ALL ON public.event_escrow_ledger TO service_role;

CREATE OR REPLACE FUNCTION public.notify_co_sponsor_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_title TEXT;
  v_club_name TEXT;
  v_admin_id UUID;
BEGIN
  SELECT title INTO v_event_title FROM public.events WHERE id = NEW.event_id;
  SELECT name INTO v_club_name FROM public.clubs WHERE id = NEW.club_id;

  FOR v_admin_id IN
    SELECT cm.user_id
    FROM public.club_members cm
    WHERE cm.club_id = NEW.club_id
      AND cm.status = 'approved'
      AND cm.role::TEXT IN ('admin', 'owner', 'president', 'treasurer', 'officer')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_admin_id,
      'co_sponsor_request',
      'Co-Sponsorship Request',
      'Your club, ' || COALESCE(v_club_name, 'your club') ||
        ', has been asked to contribute $' || TO_CHAR(NEW.contribution_amount, 'FM999999990.00') ||
        ' to "' || COALESCE(v_event_title, 'an event') || '".',
      '/events/' || NEW.event_id || '?coSponsor=' || NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_co_sponsor_request ON public.co_sponsors;
CREATE TRIGGER trg_notify_co_sponsor_request
  AFTER INSERT ON public.co_sponsors
  FOR EACH ROW EXECUTE FUNCTION public.notify_co_sponsor_request();

CREATE OR REPLACE FUNCTION public.create_co_sponsor_request(
  p_event_id UUID,
  p_club_id UUID,
  p_contribution_amount NUMERIC(12, 2)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.co_sponsors;
  v_primary_club UUID;
BEGIN
  IF NOT public.is_event_admin(p_event_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only an event organizer can request a co-sponsor.' USING ERRCODE = '42501';
  END IF;
  IF p_contribution_amount IS NULL OR p_contribution_amount <= 0 THEN
    RAISE EXCEPTION 'Contribution amount must be greater than zero.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = p_club_id) THEN
    RAISE EXCEPTION 'Co-sponsoring club was not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT eh.club_id INTO v_primary_club
  FROM public.event_hosts eh
  WHERE eh.event_id = p_event_id AND eh.is_primary_host = TRUE
  LIMIT 1;
  IF v_primary_club = p_club_id THEN
    RAISE EXCEPTION 'The event primary club cannot be its own co-sponsor.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.co_sponsors (event_id, club_id, requested_by, contribution_amount)
  VALUES (p_event_id, p_club_id, auth.uid(), ROUND(p_contribution_amount, 2))
  RETURNING * INTO v_request;

  RETURN jsonb_build_object(
    'success', TRUE,
    'request_id', v_request.id,
    'status', v_request.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_co_sponsor_request(
  p_request_id UUID,
  p_approved BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.co_sponsors;
  v_balance NUMERIC(12, 2);
  v_event_title TEXT;
BEGIN
  SELECT * INTO v_request
  FROM public.co_sponsors
  WHERE id = p_request_id
  FOR UPDATE;
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Co-sponsorship request was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_club_admin_check(v_request.club_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the requested club treasurer or administrator can respond.' USING ERRCODE = '42501';
  END IF;
  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('success', TRUE, 'status', v_request.status, 'idempotent', TRUE);
  END IF;

  IF NOT p_approved THEN
    UPDATE public.co_sponsors
    SET status = 'rejected', updated_at = NOW()
    WHERE id = v_request.id;
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_request.requested_by,
      'co_sponsor_response',
      'Co-Sponsorship Declined',
      'Your co-sponsorship request was declined by the requested club.',
      '/events/' || v_request.event_id
    );
    RETURN jsonb_build_object('success', TRUE, 'status', 'rejected');
  END IF;

  PERFORM 1 FROM public.clubs WHERE id = v_request.club_id FOR UPDATE;
  SELECT COALESCE(SUM(amount), 0)
  INTO v_balance
  FROM public.club_transactions
  WHERE club_id = v_request.club_id;
  IF v_balance < v_request.contribution_amount THEN
    RAISE EXCEPTION 'The club ledger does not have enough available balance.' USING ERRCODE = '23514';
  END IF;

  SELECT title INTO v_event_title FROM public.events WHERE id = v_request.event_id;
  UPDATE public.co_sponsors
  SET status = 'approved', approved_by = auth.uid(), approved_at = NOW(), updated_at = NOW()
  WHERE id = v_request.id;

  INSERT INTO public.club_transactions (
    club_id, amount, transaction_type, category, description, co_sponsor_id
  ) VALUES (
    v_request.club_id,
    -v_request.contribution_amount,
    'EXPENSE',
    'Co-Sponsorship',
    'Co-sponsorship contribution for ' || COALESCE(v_event_title, 'event'),
    v_request.id
  ) ON CONFLICT (co_sponsor_id) DO NOTHING;

  INSERT INTO public.event_escrow_ledger (event_id, co_sponsor_id, club_id, amount, entry_type)
  VALUES (v_request.event_id, v_request.id, v_request.club_id, v_request.contribution_amount, 'deposit')
  ON CONFLICT (co_sponsor_id, entry_type) DO NOTHING;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_request.requested_by,
    'co_sponsor_response',
    'Co-Sponsorship Approved',
    'Your co-sponsorship request was approved and the contribution was placed in event escrow.',
    '/events/' || v_request.event_id
  );
  RETURN jsonb_build_object('success', TRUE, 'status', 'approved', 'amount', v_request.contribution_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_event_co_sponsors()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.co_sponsors;
  v_event_title TEXT;
  v_admin_id UUID;
BEGIN
  IF NEW.status::TEXT NOT IN ('cancelled', 'canceled')
     OR OLD.status::TEXT IN ('cancelled', 'canceled') THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_event_title FROM public.events WHERE id = NEW.id;
  FOR v_request IN
    SELECT * FROM public.co_sponsors
    WHERE event_id = NEW.id AND status = 'approved'
    FOR UPDATE
  LOOP
    INSERT INTO public.club_transactions (
      club_id, amount, transaction_type, category, description, co_sponsor_id
    ) VALUES (
      v_request.club_id,
      v_request.contribution_amount,
      'INCOME',
      'Co-Sponsorship Refund',
      'Refund for canceled co-sponsored event ' || COALESCE(v_event_title, 'event'),
      v_request.id
    ) ON CONFLICT DO NOTHING;

    INSERT INTO public.event_escrow_ledger (event_id, co_sponsor_id, club_id, amount, entry_type)
    VALUES (v_request.event_id, v_request.id, v_request.club_id, -v_request.contribution_amount, 'refund')
    ON CONFLICT (co_sponsor_id, entry_type) DO NOTHING;

    UPDATE public.co_sponsors
    SET status = 'refunded', refunded_at = NOW(), updated_at = NOW()
    WHERE id = v_request.id;

    FOR v_admin_id IN
      SELECT cm.user_id
      FROM public.club_members cm
      WHERE cm.club_id = v_request.club_id
        AND cm.status = 'approved'
        AND cm.role::TEXT IN ('admin', 'owner', 'president', 'treasurer', 'officer')
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        v_admin_id,
        'co_sponsor_refund',
        'Co-Sponsorship Refunded',
        'The co-sponsorship contribution of $' || TO_CHAR(v_request.contribution_amount, 'FM999999990.00') ||
          ' was refunded after the event was canceled.',
        '/events/' || NEW.id
      );
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refund_event_co_sponsors ON public.events;
CREATE TRIGGER trg_refund_event_co_sponsors
  AFTER UPDATE OF status ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.refund_event_co_sponsors();

GRANT EXECUTE ON FUNCTION public.create_co_sponsor_request(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_co_sponsor_request(UUID, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.refund_event_co_sponsors() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.co_sponsors IS
  'Atomic event co-sponsorship requests and approvals. Issue #4032.';
COMMENT ON TABLE public.event_escrow_ledger IS
  'Event-scoped escrow deposits and cancellation refunds linked to club ledger entries.';
