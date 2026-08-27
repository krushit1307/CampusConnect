-- Issue #4542: Dynamic Resource Constraint Inter-Club Bartering.
-- The active club resource calendar uses inventory_items and item_reservations.
-- Offers are accepted only through SECURITY DEFINER RPCs so booking ownership
-- and consideration transfer commit in one transaction.

ALTER TABLE public.item_reservations
  ADD COLUMN IF NOT EXISTS booking_club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL;

UPDATE public.item_reservations ir
SET booking_club_id = i.owner_club_id
FROM public.inventory_items i
WHERE i.id = ir.item_id
  AND ir.booking_club_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_reservations_booking_club
  ON public.item_reservations(booking_club_id, start_time);

CREATE OR REPLACE FUNCTION public.set_item_reservation_booking_club()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.booking_club_id IS NULL THEN
    SELECT owner_club_id
      INTO NEW.booking_club_id
    FROM public.inventory_items
    WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_item_reservation_booking_club ON public.item_reservations;
CREATE TRIGGER trg_set_item_reservation_booking_club
  BEFORE INSERT ON public.item_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_item_reservation_booking_club();

CREATE OR REPLACE FUNCTION public.protect_item_reservation_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.booking_club_id IS DISTINCT FROM OLD.booking_club_id
  ) AND COALESCE(current_setting('app.resource_barter_transfer', TRUE), '') <> 'on' THEN
    RAISE EXCEPTION 'Booking ownership can only change through the barter acceptance workflow.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_item_reservation_ownership ON public.item_reservations;
CREATE TRIGGER trg_protect_item_reservation_ownership
  BEFORE UPDATE ON public.item_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_item_reservation_ownership();

CREATE TABLE IF NOT EXISTS public.resource_barter_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.item_reservations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  owner_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  offer_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  offered_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  consideration_type TEXT NOT NULL CHECK (consideration_type IN ('points', 'ledger')),
  amount_points INTEGER,
  amount_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  responded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT resource_barter_offer_distinct_clubs CHECK (owner_club_id <> offer_club_id),
  CONSTRAINT resource_barter_offer_amounts CHECK (
    (consideration_type = 'points' AND amount_points IS NOT NULL AND amount_points > 0 AND amount_cents IS NULL)
    OR
    (consideration_type = 'ledger' AND amount_cents IS NOT NULL AND amount_cents > 0 AND amount_points IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_resource_barter_offers_reservation
  ON public.resource_barter_offers(reservation_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_barter_offers_owner_club
  ON public.resource_barter_offers(owner_club_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_barter_offers_offer_club
  ON public.resource_barter_offers(offer_club_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_barter_one_accepted
  ON public.resource_barter_offers(reservation_id)
  WHERE status = 'accepted';
CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_barter_one_pending_per_club
  ON public.resource_barter_offers(reservation_id, offer_club_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.resource_barter_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL UNIQUE REFERENCES public.resource_barter_offers(id) ON DELETE RESTRICT,
  from_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
  to_club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
  settled_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  consideration_type TEXT NOT NULL CHECK (consideration_type IN ('points', 'ledger')),
  amount_points INTEGER,
  amount_cents INTEGER,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT resource_barter_settlement_amounts CHECK (
    (consideration_type = 'points' AND amount_points IS NOT NULL AND amount_points > 0 AND amount_cents IS NULL)
    OR
    (consideration_type = 'ledger' AND amount_cents IS NOT NULL AND amount_cents > 0 AND amount_points IS NULL)
  )
);

ALTER TABLE public.resource_barter_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Barter settlements visible to participating clubs" ON public.resource_barter_settlements;
CREATE POLICY "Barter settlements visible to participating clubs"
  ON public.resource_barter_settlements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id IN (from_club_id, to_club_id)
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
  );
REVOKE INSERT, UPDATE, DELETE ON public.resource_barter_settlements FROM anon, authenticated;
GRANT SELECT ON public.resource_barter_settlements TO authenticated;

ALTER TABLE public.club_transactions
  ADD COLUMN IF NOT EXISTS resource_barter_offer_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'club_transactions_resource_barter_offer_id_fkey'
      AND conrelid = 'public.club_transactions'::regclass
  ) THEN
    ALTER TABLE public.club_transactions
      ADD CONSTRAINT club_transactions_resource_barter_offer_id_fkey
      FOREIGN KEY (resource_barter_offer_id)
      REFERENCES public.resource_barter_offers(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_transactions_barter_debit
  ON public.club_transactions(resource_barter_offer_id)
  WHERE resource_barter_offer_id IS NOT NULL AND transaction_type = 'EXPENSE';

ALTER TABLE public.resource_barter_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Barter offers visible to participating clubs" ON public.resource_barter_offers;
CREATE POLICY "Barter offers visible to participating clubs"
  ON public.resource_barter_offers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id IN (owner_club_id, offer_club_id)
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.resource_barter_offers FROM anon, authenticated;
GRANT SELECT ON public.resource_barter_offers TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_resource_barter_club(
  p_club_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clubs c
    WHERE c.id = p_club_id
      AND (
        c.created_by = p_user_id
        OR public.has_club_permission(p_club_id, p_user_id, 'budget.read')
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = p_user_id
            AND p.role::TEXT IN ('admin', 'owner', 'system_admin')
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_barterable_resource_bookings(
  p_offer_club_id UUID
)
RETURNS TABLE (
  reservation_id UUID,
  item_id UUID,
  item_name TEXT,
  owner_club_id UUID,
  owner_club_name TEXT,
  owner_club_slug TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  current_booking_club_id UUID
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    ir.id,
    ir.item_id,
    i.name,
    i.owner_club_id,
    owner_club.name,
    owner_club.slug,
    ir.start_time,
    ir.end_time,
    COALESCE(ir.booking_club_id, i.owner_club_id)
  FROM public.item_reservations ir
  JOIN public.inventory_items i ON i.id = ir.item_id
  JOIN public.clubs owner_club ON owner_club.id = i.owner_club_id
  WHERE ir.status = 'approved'
    AND ir.start_time > NOW()
    AND i.owner_club_id <> p_offer_club_id
    AND COALESCE(ir.booking_club_id, i.owner_club_id) = i.owner_club_id
    AND public.can_manage_resource_barter_club(p_offer_club_id, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_resource_barter_offers(
  p_club_id UUID
)
RETURNS TABLE (
  id UUID,
  reservation_id UUID,
  item_id UUID,
  item_name TEXT,
  owner_club_id UUID,
  owner_club_name TEXT,
  offer_club_id UUID,
  offer_club_name TEXT,
  offered_by UUID,
  consideration_type TEXT,
  amount_points INTEGER,
  amount_cents INTEGER,
  status TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    bo.id,
    bo.reservation_id,
    bo.item_id,
    i.name,
    bo.owner_club_id,
    owner_club.name,
    bo.offer_club_id,
    offer_club.name,
    bo.offered_by,
    bo.consideration_type,
    bo.amount_points,
    bo.amount_cents,
    bo.status,
    ir.start_time,
    ir.end_time,
    bo.created_at,
    bo.responded_at
  FROM public.resource_barter_offers bo
  JOIN public.item_reservations ir ON ir.id = bo.reservation_id
  JOIN public.inventory_items i ON i.id = bo.item_id
  JOIN public.clubs owner_club ON owner_club.id = bo.owner_club_id
  JOIN public.clubs offer_club ON offer_club.id = bo.offer_club_id
  WHERE (bo.owner_club_id = p_club_id OR bo.offer_club_id = p_club_id)
    AND public.can_manage_resource_barter_club(p_club_id, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.create_resource_barter_offer(
  p_reservation_id UUID,
  p_offer_club_id UUID,
  p_consideration_type TEXT,
  p_amount_points INTEGER DEFAULT NULL,
  p_amount_cents INTEGER DEFAULT NULL
)
RETURNS public.resource_barter_offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_offer public.resource_barter_offers;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_manage_resource_barter_club(p_offer_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only an authorized club finance officer can make a barter offer.' USING ERRCODE = '42501';
  END IF;
  IF p_consideration_type NOT IN ('points', 'ledger') THEN
    RAISE EXCEPTION 'Consideration must be points or ledger.' USING ERRCODE = '22023';
  END IF;
  IF p_consideration_type = 'points' AND (p_amount_points IS NULL OR p_amount_points <= 0 OR p_amount_cents IS NOT NULL) THEN
    RAISE EXCEPTION 'Points offers require a positive points amount.' USING ERRCODE = '22023';
  END IF;
  IF p_consideration_type = 'ledger' AND (p_amount_cents IS NULL OR p_amount_cents <= 0 OR p_amount_points IS NOT NULL) THEN
    RAISE EXCEPTION 'Ledger offers require a positive amount in cents.' USING ERRCODE = '22023';
  END IF;

  SELECT ir.*, i.owner_club_id, i.name AS item_name
    INTO v_reservation
  FROM public.item_reservations ir
  JOIN public.inventory_items i ON i.id = ir.item_id
  WHERE ir.id = p_reservation_id
  FOR UPDATE OF ir;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booked resource reservation was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_reservation.status <> 'approved' OR v_reservation.start_time <= NOW() THEN
    RAISE EXCEPTION 'Only future approved bookings can receive barter offers.' USING ERRCODE = '22023';
  END IF;
  IF v_reservation.owner_club_id = p_offer_club_id THEN
    RAISE EXCEPTION 'A club cannot barter for its own booking.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_reservation.booking_club_id, v_reservation.owner_club_id) <> v_reservation.owner_club_id THEN
    RAISE EXCEPTION 'This booking has already been transferred.' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.resource_barter_offers (
    reservation_id,
    item_id,
    owner_club_id,
    offer_club_id,
    offered_by,
    consideration_type,
    amount_points,
    amount_cents
  )
  VALUES (
    p_reservation_id,
    v_reservation.item_id,
    v_reservation.owner_club_id,
    p_offer_club_id,
    auth.uid(),
    p_consideration_type,
    p_amount_points,
    p_amount_cents
  )
  RETURNING * INTO v_offer;

  RETURN v_offer;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_resource_barter_offer(
  p_offer_id UUID,
  p_accept BOOLEAN
)
RETURNS public.resource_barter_offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.resource_barter_offers;
  v_reservation RECORD;
  v_owner_name TEXT;
  v_offer_name TEXT;
  v_offer_club_slug TEXT;
  v_item_name TEXT;
  v_offer_amount NUMERIC(12, 2);
  v_club_balance NUMERIC(12, 2);
  v_points_balance INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_offer
  FROM public.resource_barter_offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Barter offer was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.can_manage_resource_barter_club(v_offer.owner_club_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the booked resource owner club can respond to this offer.' USING ERRCODE = '42501';
  END IF;
  IF v_offer.status <> 'pending' THEN
    RETURN v_offer;
  END IF;

  SELECT ir.*, i.name AS item_name
    INTO v_reservation
  FROM public.item_reservations ir
  JOIN public.inventory_items i ON i.id = v_offer.item_id
  WHERE ir.id = v_offer.reservation_id
  FOR UPDATE OF ir;

  IF NOT FOUND OR v_reservation.status <> 'approved' THEN
    RAISE EXCEPTION 'The underlying booking is no longer available.' USING ERRCODE = '55000';
  END IF;
  IF v_reservation.start_time <= NOW() THEN
    RAISE EXCEPTION 'The booking has already started.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_reservation.booking_club_id, v_offer.owner_club_id) <> v_offer.owner_club_id THEN
    RAISE EXCEPTION 'The booking has already been transferred.' USING ERRCODE = '55000';
  END IF;

  SELECT name, slug INTO v_offer_name, v_offer_club_slug
  FROM public.clubs
  WHERE id = v_offer.offer_club_id;

  IF NOT p_accept THEN
    UPDATE public.resource_barter_offers
       SET status = 'rejected', responded_by = auth.uid(), responded_at = NOW()
     WHERE id = v_offer.id
     RETURNING * INTO v_offer;

    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_offer.offered_by,
      'resource_barter_response',
      'Barter offer declined',
      'Your offer for "' || v_reservation.item_name || '" was declined by the booked resource club.',
      '/clubs/' || COALESCE(v_offer_club_slug, '') || '/resources'
    );
    RETURN v_offer;
  END IF;

  SELECT name INTO v_owner_name FROM public.clubs WHERE id = v_offer.owner_club_id;
  SELECT name, slug INTO v_offer_name, v_offer_club_slug FROM public.clubs WHERE id = v_offer.offer_club_id;
  v_item_name := v_reservation.item_name;

  IF v_offer.consideration_type = 'ledger' THEN
    PERFORM 1 FROM public.clubs WHERE id = v_offer.offer_club_id FOR UPDATE;
    SELECT COALESCE(SUM(amount), 0)
      INTO v_club_balance
    FROM public.club_transactions
    WHERE club_id = v_offer.offer_club_id;
    v_offer_amount := v_offer.amount_cents::NUMERIC / 100.00;
    IF v_club_balance < v_offer_amount THEN
      RAISE EXCEPTION 'The offering club does not have enough ledger balance.' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.club_transactions (
      club_id, amount, transaction_type, category, description, resource_barter_offer_id
    ) VALUES (
      v_offer.offer_club_id,
      -v_offer_amount,
      'EXPENSE',
      'Resource Barter',
      'Barter payment for "' || v_item_name || '" from ' || COALESCE(v_owner_name, 'owner club'),
      v_offer.id
    );
    INSERT INTO public.club_transactions (
      club_id, amount, transaction_type, category, description, resource_barter_offer_id
    ) VALUES (
      v_offer.owner_club_id,
      v_offer_amount,
      'INCOME',
      'Resource Barter',
      'Barter payment for "' || v_item_name || '" from ' || COALESCE(v_offer_name, 'offering club'),
      v_offer.id
    );
  ELSE
    PERFORM pg_advisory_xact_lock(hashtextextended('resource-barter-points:' || v_offer.offered_by::TEXT, 0));
    SELECT COALESCE(SUM(points), 0)
      INTO v_points_balance
    FROM public.gamification_points
    WHERE user_id = v_offer.offered_by;
    IF v_points_balance < v_offer.amount_points THEN
      RAISE EXCEPTION 'The offering user does not have enough gamification points.' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.gamification_points (user_id, points, reason)
    VALUES (
      v_offer.offered_by,
      -v_offer.amount_points,
      'Resource barter payment for "' || v_item_name || '"'
    );
    INSERT INTO public.gamification_points (user_id, points, reason)
    VALUES (
      auth.uid(),
      v_offer.amount_points,
      'Resource barter receipt for "' || v_item_name || '"'
    );
  END IF;

  INSERT INTO public.resource_barter_settlements (
    offer_id,
    from_club_id,
    to_club_id,
    settled_by,
    consideration_type,
    amount_points,
    amount_cents
  ) VALUES (
    v_offer.id,
    v_offer.offer_club_id,
    v_offer.owner_club_id,
    auth.uid(),
    v_offer.consideration_type,
    v_offer.amount_points,
    v_offer.amount_cents
  );

  PERFORM set_config('app.resource_barter_transfer', 'on', TRUE);
  UPDATE public.item_reservations
     SET booking_club_id = v_offer.offer_club_id,
         user_id = v_offer.offered_by
   WHERE id = v_offer.reservation_id;

  UPDATE public.resource_barter_offers
     SET status = 'accepted', responded_by = auth.uid(), responded_at = NOW()
   WHERE id = v_offer.id
   RETURNING * INTO v_offer;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_offer.offered_by,
    'resource_barter_response',
    'Barter offer accepted',
    'Your offer for "' || v_item_name || '" was accepted. The booking and consideration transfer are complete.',
    '/clubs/' || v_offer.offer_club_id::TEXT || '/resources'
  );

  RETURN v_offer;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_resource_barter_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name TEXT;
  v_offer_club_name TEXT;
  v_owner_club_slug TEXT;
  v_admin_id UUID;
BEGIN
  SELECT i.name, offering_club.name, owner_club.slug
    INTO v_item_name, v_offer_club_name, v_owner_club_slug
  FROM public.inventory_items i
  JOIN public.clubs offering_club ON offering_club.id = NEW.offer_club_id
  JOIN public.clubs owner_club ON owner_club.id = NEW.owner_club_id
  WHERE i.id = NEW.item_id;

  FOR v_admin_id IN
    SELECT cm.user_id
    FROM public.club_members cm
    WHERE cm.club_id = NEW.owner_club_id
      AND cm.status = 'approved'
      AND LOWER(cm.role::TEXT) IN ('treasurer', 'president', 'admin', 'owner', 'officer')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_admin_id,
      'resource_barter_offer',
      'New resource barter offer',
      COALESCE(v_offer_club_name, 'Another club') || ' offered ' ||
        CASE WHEN NEW.consideration_type = 'points'
          THEN NEW.amount_points::TEXT || ' gamification points'
          ELSE '$' || TO_CHAR(NEW.amount_cents::NUMERIC / 100.00, 'FM999999990.00')
        END || ' for your "' || COALESCE(v_item_name, 'resource') || '" booking.',
      '/clubs/' || COALESCE(v_owner_club_slug, '') || '/resources'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_resource_barter_offer ON public.resource_barter_offers;
CREATE TRIGGER trg_notify_resource_barter_offer
  AFTER INSERT ON public.resource_barter_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_resource_barter_offer();

REVOKE ALL ON FUNCTION public.can_manage_resource_barter_club(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_barterable_resource_bookings(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_resource_barter_offers(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_resource_barter_offer(UUID, UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_to_resource_barter_offer(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_resource_barter_club(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_barterable_resource_bookings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_resource_barter_offers(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_resource_barter_offer(UUID, UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_resource_barter_offer(UUID, BOOLEAN) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.resource_barter_offers;

COMMENT ON TABLE public.resource_barter_offers IS
  'Cross-club offers for future approved item reservations. Acceptance atomically transfers booking ownership and consideration.';
