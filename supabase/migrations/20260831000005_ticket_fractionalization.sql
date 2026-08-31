-- =============================================================================
-- Migration: 20260831000005_ticket_fractionalization.sql
-- Description: Issue #5375 - Real-Time "Dynamic Pricing" Dutch Auction
--              (Secondary Market Ticket Fractionalization)
--
-- Time-sliced ERC-1155-style ticket fractionalization. A monolithic ticket
-- (event_rsvps row) can be split into N time intervals ("slices"). Each slice
-- carries its own entry window, its own owner, and its own QR identity
-- (slice_token). Slices are listed on a secondary market where the price
-- decays over time via a Dutch auction clock (mirroring the existing
-- dutch_auction_system).
--
-- Lifecycle:
--   available -> listed -> sold          (secondary-market transfer of ownership)
--   available/listed/sold -> burned      (bouncer scans the slice QR at the door;
--                                         the slice's entry window has arrived)
--
-- Only the slice in whose window the event currently sits may be burned, so a
-- buyer who acquires "Hour 3" cannot enter during "Hour 1".
-- =============================================================================

BEGIN;

-- 1. Ticket slices ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_slices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The originating monolithic ticket (event_rsvps.id).
  rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  -- The slice's entry window (inclusive start, exclusive end).
  slice_start TIMESTAMPTZ NOT NULL,
  slice_end TIMESTAMPTZ NOT NULL,
  -- The fractional entry credential. Encoded in the slice QR code and used by
  -- the bouncer to burn the slice. Regenerated on each ownership transfer.
  slice_token UUID NOT NULL DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- available | listed | sold | burned
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'listed', 'sold', 'burned')),
  listed_price_cents INTEGER, -- captured when the slice is listed for sale
  sold_price_cents INTEGER,   -- final Dutch-auction price paid by the buyer
  burned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_slice_window CHECK (slice_end > slice_start),
  CONSTRAINT chk_slice_sold_price CHECK (sold_price_cents IS NULL OR sold_price_cents >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_slices_token ON public.ticket_slices(slice_token);
CREATE INDEX IF NOT EXISTS idx_ticket_slices_owner ON public.ticket_slices(owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_ticket_slices_event ON public.ticket_slices(event_id, status);
CREATE INDEX IF NOT EXISTS idx_ticket_slices_rsvp ON public.ticket_slices(rsvp_id, slice_start);

-- RLS: owners see their own slices; public can see only unsold/burned-away
-- slices (needed to render the marketplace) with no PII.
ALTER TABLE public.ticket_slices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage their ticket slices" ON public.ticket_slices;
CREATE POLICY "Owners can manage their ticket slices" ON public.ticket_slices
  FOR ALL TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Public can view listed and burned ticket slices" ON public.ticket_slices;
CREATE POLICY "Public can view listed and burned ticket slices" ON public.ticket_slices
  FOR SELECT TO authenticated, anon
  USING (status IN ('listed', 'burned'));

-- 2. Slice Dutch auctions ---------------------------------------------------
-- Each listed slice gets a descending-price auction (the same clock model as
-- dutch_auctions, but for a single fractional slice).
CREATE TABLE IF NOT EXISTS public.ticket_slice_auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slice_id UUID NOT NULL REFERENCES public.ticket_slices(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_price_cents INTEGER NOT NULL,
  min_price_cents INTEGER NOT NULL,
  price_drop_interval_seconds INTEGER NOT NULL DEFAULT 60,
  price_drop_amount_cents INTEGER NOT NULL DEFAULT 100,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_slice_auction_prices CHECK (start_price_cents >= min_price_cents),
  CONSTRAINT chk_slice_auction_intervals CHECK (price_drop_interval_seconds > 0 AND price_drop_amount_cents > 0),
  CONSTRAINT chk_slice_auction_timeline CHECK (ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_slice_auctions_event ON public.ticket_slice_auctions(event_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_slice_auctions_slice ON public.ticket_slice_auctions(slice_id);

ALTER TABLE public.ticket_slice_auctions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active slice auctions" ON public.ticket_slice_auctions;
CREATE POLICY "Public can view active slice auctions" ON public.ticket_slice_auctions
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Sellers can manage their slice auctions" ON public.ticket_slice_auctions;
CREATE POLICY "Sellers can manage their slice auctions" ON public.ticket_slice_auctions
  FOR ALL TO authenticated
  USING (auth.uid() = seller_user_id)
  WITH CHECK (auth.uid() = seller_user_id);

-- 3. Slice purchases --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_slice_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.ticket_slice_auctions(id) ON DELETE CASCADE,
  slice_id UUID NOT NULL REFERENCES public.ticket_slices(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  price_paid_cents INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slice_purchases_buyer ON public.ticket_slice_purchases(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_slice_purchases_auction ON public.ticket_slice_purchases(auction_id);

ALTER TABLE public.ticket_slice_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers and sellers can view their slice purchases" ON public.ticket_slice_purchases;
CREATE POLICY "Buyers and sellers can view their slice purchases" ON public.ticket_slice_purchases
  FOR SELECT TO authenticated
  USING (auth.uid() = buyer_user_id OR auth.uid() = seller_user_id);

-- 4. RPC: fractionalize a ticket -------------------------------------------
-- Splits a monolithic RSVP into N equal time slices. Only the ticket owner may
-- call it, only before the event starts, and only for an un-checked-in RSVP.
CREATE OR REPLACE FUNCTION public.fractionalize_ticket(
  p_rsvp_id UUID,
  p_user_id UUID,
  p_slice_count INTEGER DEFAULT 2
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rsvp RECORD;
  v_event RECORD;
  v_duration_seconds NUMERIC;
  v_slice_seconds NUMERIC;
  v_i INTEGER;
  v_slice_start TIMESTAMPTZ;
  v_slice_end TIMESTAMPTZ;
  v_slice_id UUID;
BEGIN
  IF p_slice_count < 2 OR p_slice_count > 24 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Slice count must be between 2 and 24.');
  END IF;

  SELECT * INTO v_rsvp FROM public.event_rsvps
  WHERE id = p_rsvp_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Ticket not found.');
  END IF;

  IF v_rsvp.user_id <> p_user_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Not the ticket owner.');
  END IF;

  IF v_rsvp.checked_in THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Ticket has already been checked in.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.ticket_slices WHERE rsvp_id = p_rsvp_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Ticket has already been fractionalized.');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_rsvp.event_id;
  IF NOT FOUND OR v_event.start_date IS NULL OR v_event.end_date IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Event has no time window.');
  END IF;

  IF NOW() >= v_event.start_date THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Cannot fractionalize after the event has started.');
  END IF;

  v_duration_seconds := EXTRACT(EPOCH FROM (v_event.end_date - v_event.start_date));
  v_slice_seconds := FLOOR(v_duration_seconds / p_slice_count);

  FOR v_i IN 1..p_slice_count LOOP
    v_slice_start := v_event.start_date + ((v_i - 1) * v_slice_seconds * INTERVAL '1 second');
    IF v_i = p_slice_count THEN
      v_slice_end := v_event.end_date;
    ELSE
      v_slice_end := v_event.start_date + (v_i * v_slice_seconds * INTERVAL '1 second');
    END IF;

    INSERT INTO public.ticket_slices (
      rsvp_id, event_id, slice_start, slice_end, slice_token, owner_user_id
    ) VALUES (
      p_rsvp_id, v_rsvp.event_id, v_slice_start, v_slice_end, gen_random_uuid(), p_user_id
    ) RETURNING id INTO v_slice_id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'rsvp_id', p_rsvp_id,
    'slice_count', p_slice_count,
    'event_start', v_event.start_date,
    'event_end', v_event.end_date
  );
END;
$$;

-- 5. RPC: list a slice on the Dutch-auction secondary market ---------------
CREATE OR REPLACE FUNCTION public.list_ticket_slice_auction(
  p_slice_id UUID,
  p_seller_id UUID,
  p_start_price_cents INTEGER,
  p_min_price_cents INTEGER,
  p_price_drop_interval_seconds INTEGER DEFAULT 60,
  p_price_drop_amount_cents INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slice RECORD;
  v_auction_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_slice FROM public.ticket_slices
  WHERE id = p_slice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Slice not found.');
  END IF;

  IF v_slice.owner_user_id <> p_seller_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Not the slice owner.');
  END IF;

  IF v_slice.status <> 'available' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Slice is not available for listing.');
  END IF;

  IF p_start_price_cents < 0 OR p_min_price_cents < 0 OR p_start_price_cents < p_min_price_cents THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid auction price bounds.');
  END IF;

  -- Auction runs from now until the slice's entry window begins, so buyers
  -- have a bounded window and the slice cannot be sold after entry opens.
  UPDATE public.ticket_slices
  SET status = 'listed',
      listed_price_cents = p_start_price_cents,
      updated_at = v_now
  WHERE id = p_slice_id;

  INSERT INTO public.ticket_slice_auctions (
    slice_id, event_id, seller_user_id,
    start_price_cents, min_price_cents,
    price_drop_interval_seconds, price_drop_amount_cents,
    starts_at, ends_at
  ) VALUES (
    p_slice_id, v_slice.event_id, p_seller_id,
    p_start_price_cents, p_min_price_cents,
    p_price_drop_interval_seconds, p_price_drop_amount_cents,
    v_now, v_slice.slice_start
  ) RETURNING id INTO v_auction_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'auction_id', v_auction_id,
    'slice_id', p_slice_id,
    'ends_at', v_slice.slice_start
  );
END;
$$;

-- 6. RPC: current Dutch-auction price for a slice --------------------------
CREATE OR REPLACE FUNCTION public.get_slice_auction_current_price(
  p_auction_id UUID,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_elapsed INTEGER;
  v_intervals INTEGER;
  v_current_price INTEGER;
BEGIN
  SELECT * INTO v_auction FROM public.ticket_slice_auctions WHERE id = p_auction_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF p_now < v_auction.starts_at THEN
    RETURN v_auction.start_price_cents;
  END IF;

  IF p_now >= v_auction.ends_at THEN
    RETURN v_auction.min_price_cents;
  END IF;

  v_elapsed := EXTRACT(EPOCH FROM (p_now - v_auction.starts_at))::INTEGER;
  v_intervals := FLOOR(v_elapsed::NUMERIC / v_auction.price_drop_interval_seconds::NUMERIC)::INTEGER;
  v_current_price := v_auction.start_price_cents - (v_intervals * v_auction.price_drop_amount_cents);

  RETURN GREATEST(v_current_price, v_auction.min_price_cents);
END;
$$;

-- 7. RPC: purchase a slice at the current Dutch price ----------------------
CREATE OR REPLACE FUNCTION public.purchase_slice_auction(
  p_auction_id UUID,
  p_buyer_id UUID,
  p_max_price_cents INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction RECORD;
  v_slice RECORD;
  v_current_price INTEGER;
  v_purchase_id UUID;
  v_new_token UUID := gen_random_uuid();
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_auction FROM public.ticket_slice_auctions
  WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Auction not found.');
  END IF;

  IF NOT v_auction.is_active THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Auction is inactive.');
  END IF;

  IF v_now < v_auction.starts_at THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Auction has not started yet.');
  END IF;

  IF v_now > v_auction.ends_at THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Auction has ended.');
  END IF;

  IF v_auction.seller_user_id = p_buyer_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Cannot buy your own slice.');
  END IF;

  v_current_price := public.get_slice_auction_current_price(p_auction_id, v_now);

  IF v_current_price > p_max_price_cents THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Price is ' || v_current_price::TEXT || ' cents, exceeding your limit of ' || p_max_price_cents::TEXT || ' cents.'
    );
  END IF;

  SELECT * INTO v_slice FROM public.ticket_slices
  WHERE id = v_auction.slice_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Slice not found.');
  END IF;

  IF v_slice.status <> 'listed' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Slice is no longer listed.');
  END IF;

  -- Transfer ownership, regenerate the entry credential, and record the sale.
  UPDATE public.ticket_slices
  SET owner_user_id = p_buyer_id,
      slice_token = v_new_token,
      status = 'sold',
      sold_price_cents = v_current_price,
      listed_price_cents = NULL,
      updated_at = v_now
  WHERE id = v_slice.id;

  UPDATE public.ticket_slice_auctions
  SET is_active = FALSE
  WHERE id = p_auction_id;

  INSERT INTO public.ticket_slice_purchases (
    auction_id, slice_id, buyer_user_id, seller_user_id, price_paid_cents, purchased_at
  ) VALUES (
    p_auction_id, v_slice.id, p_buyer_id, v_auction.seller_user_id, v_current_price, v_now
  ) RETURNING id INTO v_purchase_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'purchase_id', v_purchase_id,
    'slice_id', v_slice.id,
    'price_paid_cents', v_current_price
  );
END;
$$;

-- 8. RPC: burn a slice at the door ------------------------------------------
-- Called by the bouncer when a slice QR is scanned. The slice's entry window
-- must be active (now within [slice_start, slice_end)) and the scan must
-- present the current slice_token. A slice is burned exactly once.
CREATE OR REPLACE FUNCTION public.burn_ticket_slice(
  p_slice_token UUID,
  p_scanner_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slice RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_slice FROM public.ticket_slices
  WHERE slice_token = p_slice_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid slice token.');
  END IF;

  IF v_slice.status = 'burned' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Slice has already been used.');
  END IF;

  IF v_now < v_slice.slice_start THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'Entry not open yet. Window starts at ' || v_slice.slice_start::TEXT
    );
  END IF;

  IF v_now >= v_slice.slice_end THEN
    RETURN jsonb_build_object(
      'success', FALSE, 'error', 'Entry window has ended at ' || v_slice.slice_end::TEXT
    );
  END IF;

  UPDATE public.ticket_slices
  SET status = 'burned',
      burned_at = v_now,
      updated_at = v_now
  WHERE id = v_slice.id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'slice_id', v_slice.id,
    'event_id', v_slice.event_id,
    'owner_user_id', v_slice.owner_user_id,
    'slice_start', v_slice.slice_start,
    'slice_end', v_slice.slice_end,
    'burned_at', v_now
  );
END;
$$;

-- 9. RPC: list a user's slices ----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_ticket_slices(
  p_user_id UUID,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  slice_id UUID,
  event_id UUID,
  event_title TEXT,
  slice_start TIMESTAMPTZ,
  slice_end TIMESTAMPTZ,
  status TEXT,
  slice_token UUID,
  sold_price_cents INTEGER
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ts.id, ts.event_id, e.title,
         ts.slice_start, ts.slice_end, ts.status, ts.slice_token, ts.sold_price_cents
  FROM public.ticket_slices ts
  JOIN public.events e ON e.id = ts.event_id
  WHERE ts.owner_user_id = p_user_id
    AND ts.status <> 'burned'
    AND ts.slice_end > p_now
  ORDER BY ts.slice_start ASC;
END;
$$;

-- 10. Realtime: push slice-auction state to the marketplace UI ---------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_slice_auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_slices;

-- 11. Grants ----------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.fractionalize_ticket(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_ticket_slice_auction(UUID, UUID, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_slice_auction_current_price(UUID, TIMESTAMPTZ) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.purchase_slice_auction(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.burn_ticket_slice(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_ticket_slices(UUID, TIMESTAMPTZ) TO authenticated;

COMMIT;
