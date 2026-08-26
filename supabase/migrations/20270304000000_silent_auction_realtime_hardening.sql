-- Issue #4034: Real-time silent auction hardening and winner checkout support.
-- Builds on 20260815200000_silent_auction_bidding.sql (#3021).

ALTER TABLE public.auction_items
  ADD COLUMN IF NOT EXISTS bid_increment_cents INTEGER NOT NULL DEFAULT 100
  CHECK (bid_increment_cents > 0);

ALTER TABLE public.auction_winners
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_auction_items_event_open
  ON public.auction_items(event_id, is_closed, end_time);
CREATE INDEX IF NOT EXISTS idx_auction_bids_item_created
  ON public.auction_bids(item_id, created_at DESC);

-- Public attendees may see item state, but only event organizers may manage items.
DROP POLICY IF EXISTS "Anyone can view active auction items" ON public.auction_items;
CREATE POLICY "Anyone can view auction items"
  ON public.auction_items FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Organizers can create auction items" ON public.auction_items;
CREATE POLICY "Organizers can create auction items"
  ON public.auction_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = auction_items.event_id
        AND (
          e.created_by = auth.uid()
          OR public.is_club_admin(e.club_id, auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Organizers can update auction items" ON public.auction_items;
CREATE POLICY "Organizers can update auction items"
  ON public.auction_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = auction_items.event_id
        AND (
          e.created_by = auth.uid()
          OR public.is_club_admin(e.club_id, auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = auction_items.event_id
        AND (
          e.created_by = auth.uid()
          OR public.is_club_admin(e.club_id, auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Organizers can delete auction items" ON public.auction_items;
CREATE POLICY "Organizers can delete auction items"
  ON public.auction_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = auction_items.event_id
        AND (
          e.created_by = auth.uid()
          OR public.is_club_admin(e.club_id, auth.uid())
        )
    )
  );

-- Bid history is private to the bidder and the event organizer. The attendee UI
-- listens to the sanitized auction_items state rather than receiving bidder IDs.
DROP POLICY IF EXISTS "Authenticated users can view auction bids" ON public.auction_bids;
CREATE POLICY "Bidders and organizers can view auction bids"
  ON public.auction_bids FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.auction_items ai
      JOIN public.events e ON e.id = ai.event_id
      WHERE ai.id = auction_bids.item_id
        AND (
          e.created_by = auth.uid()
          OR public.is_club_admin(e.club_id, auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Winners can view their winning records" ON public.auction_winners;
CREATE POLICY "Winners and organizers can view winning records"
  ON public.auction_winners FOR SELECT
  TO authenticated
  USING (
    winner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.auction_items ai
      JOIN public.events e ON e.id = ai.event_id
      WHERE ai.id = auction_winners.item_id
        AND (
          e.created_by = auth.uid()
          OR public.is_club_admin(e.club_id, auth.uid())
        )
    )
  );

-- Only the authenticated caller can bid for their own account. The item row is
-- locked for the complete validation/update transaction, preventing two equal
-- concurrent bids from both becoming the winner.
CREATE OR REPLACE FUNCTION public.place_silent_auction_bid(
  p_item_id UUID,
  p_user_id UUID,
  p_bid_amount INT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  new_highest_bid INT,
  new_end_time TIMESTAMPTZ,
  extended_by_anti_sniping BOOLEAN
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.auction_items%ROWTYPE;
  v_prev_bidder_id UUID;
  v_extended BOOLEAN := FALSE;
  v_new_end_time TIMESTAMPTZ;
  v_minimum_bid INTEGER;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN QUERY SELECT FALSE, 'You must bid for your authenticated account.', 0, NOW(), FALSE;
    RETURN;
  END IF;

  SELECT * INTO v_item
  FROM public.auction_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Auction item not found.', 0, NOW(), FALSE;
    RETURN;
  END IF;

  IF v_item.is_closed OR NOW() >= v_item.end_time THEN
    RETURN QUERY SELECT FALSE, 'Auction for this item has closed.', v_item.current_highest_bid, v_item.end_time, FALSE;
    RETURN;
  END IF;

  v_minimum_bid := GREATEST(
    v_item.starting_bid,
    v_item.current_highest_bid + COALESCE(v_item.bid_increment_cents, 1)
  );

  IF p_bid_amount < v_minimum_bid THEN
    RETURN QUERY SELECT FALSE,
      format('Your bid must be at least %s cents.', v_minimum_bid),
      v_item.current_highest_bid, v_item.end_time, FALSE;
    RETURN;
  END IF;

  v_prev_bidder_id := v_item.highest_bidder_id;
  v_new_end_time := v_item.end_time;

  IF v_item.end_time - NOW() <= INTERVAL '2 minutes' THEN
    v_new_end_time := NOW() + INTERVAL '5 minutes';
    v_extended := TRUE;
  END IF;

  INSERT INTO public.auction_bids (item_id, user_id, bid_amount)
  VALUES (p_item_id, p_user_id, p_bid_amount);

  UPDATE public.auction_items
  SET current_highest_bid = p_bid_amount,
      highest_bidder_id = p_user_id,
      end_time = v_new_end_time
  WHERE id = p_item_id;

  IF v_prev_bidder_id IS NOT NULL AND v_prev_bidder_id <> p_user_id THEN
    INSERT INTO public.notifications (
      user_id,
      actor_id,
      type,
      title,
      message,
      link,
      metadata
    )
    SELECT
      v_prev_bidder_id,
      p_user_id,
      'outbid_alert',
      'You have been outbid',
      format('You have been outbid on %s. Click to bid %s.', v_item.title, p_bid_amount + v_item.bid_increment_cents),
      format('/events/%s?auction_item=%s', v_item.event_id, v_item.id),
      jsonb_build_object(
        'auction_item_id', v_item.id,
        'event_id', v_item.event_id,
        'new_highest_bid_cents', p_bid_amount,
        'suggested_bid_cents', p_bid_amount + v_item.bid_increment_cents
      );
  END IF;

  RETURN QUERY SELECT TRUE, 'Bid placed successfully!', p_bid_amount, v_new_end_time, v_extended;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_silent_auction_bid(UUID, UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_silent_auction_bid(UUID, UUID, INT) TO authenticated, service_role;

-- The RPC is also safe for a scheduled sweep: it locks one item, creates one
-- winner record, and is idempotent after the item has been closed.
CREATE OR REPLACE FUNCTION public.close_silent_auction(p_item_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  winner_id UUID,
  winning_bid INT,
  message TEXT
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.auction_items%ROWTYPE;
BEGIN
  SELECT * INTO v_item
  FROM public.auction_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0, 'Auction item not found.';
    RETURN;
  END IF;

  IF v_item.is_closed THEN
    RETURN QUERY SELECT FALSE, v_item.highest_bidder_id, v_item.current_highest_bid, 'Auction is already closed.';
    RETURN;
  END IF;

  UPDATE public.auction_items SET is_closed = TRUE WHERE id = p_item_id;

  IF v_item.highest_bidder_id IS NULL THEN
    RETURN QUERY SELECT TRUE, NULL::UUID, 0, 'Auction closed with no bids placed.';
    RETURN;
  END IF;

  INSERT INTO public.auction_winners (item_id, winner_user_id, winning_bid, payment_status)
  VALUES (p_item_id, v_item.highest_bidder_id, v_item.current_highest_bid, 'pending')
  ON CONFLICT (item_id) DO NOTHING;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    link,
    metadata
  )
  VALUES (
    v_item.highest_bidder_id,
    'auction_won',
    'You won the silent auction',
    format('You won %s. Complete payment to claim it.', v_item.title),
    format('/events/%s?auction_item=%s', v_item.event_id, v_item.id),
    jsonb_build_object('auction_item_id', v_item.id, 'event_id', v_item.event_id)
  );

  RETURN QUERY SELECT TRUE, v_item.highest_bidder_id, v_item.current_highest_bid, 'Auction closed and winner recorded!';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_silent_auction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_silent_auction(UUID) TO service_role;

COMMENT ON TABLE public.auction_items IS
  'Event-linked silent auction items with realtime-safe current bid state.';
COMMENT ON FUNCTION public.place_silent_auction_bid(UUID, UUID, INT) IS
  'Atomically validates and records an authenticated bid under a row lock.';

-- Realtime clients subscribe to this sanitized append-only stream instead of
-- receiving highest_bidder_id from auction_items postgres-change payloads.
CREATE TABLE IF NOT EXISTS public.auction_item_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.auction_items(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  current_highest_bid INT NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_closed BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_item_updates_event_created
  ON public.auction_item_updates(event_id, created_at DESC);

ALTER TABLE public.auction_item_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auction_item_updates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.auction_item_updates TO anon, authenticated;
GRANT ALL ON public.auction_item_updates TO service_role;

CREATE OR REPLACE FUNCTION public.emit_auction_item_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.auction_item_updates (
    item_id, event_id, current_highest_bid, end_time, is_closed
  )
  VALUES (
    NEW.id, NEW.event_id, NEW.current_highest_bid, NEW.end_time, NEW.is_closed
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_auction_item_update ON public.auction_items;
CREATE TRIGGER trg_emit_auction_item_update
AFTER UPDATE OF current_highest_bid, end_time, is_closed ON public.auction_items
FOR EACH ROW
WHEN (
  OLD.current_highest_bid IS DISTINCT FROM NEW.current_highest_bid
  OR OLD.end_time IS DISTINCT FROM NEW.end_time
  OR OLD.is_closed IS DISTINCT FROM NEW.is_closed
)
EXECUTE FUNCTION public.emit_auction_item_update();

COMMENT ON TABLE public.auction_item_updates IS
  'Sanitized realtime auction state stream; never includes bidder identity.';

-- Close items and create winner payment links shortly after their timers expire.
-- Supabase cron is optional in local development; production uses the vault
-- service-role key to authenticate the scheduled Edge Function request.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  BEGIN
    PERFORM cron.unschedule('close-expired-silent-auctions');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'close-expired-silent-auctions',
    '* * * * *',
    $job$
      SELECT net.http_post(
        COALESCE(current_setting('app.settings.edge_function_url', true), 'http://localhost:54321/functions/v1') || '/close-expired-auctions',
        '{}'::jsonb,
        '{}'::jsonb,
        jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(
            (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
            current_setting('app.settings.service_role_key', true)
          )
        )
      );
    $job$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not install silent auction cron: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_item_updates;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Public item state omits highest_bidder_id; attendees should never be able to
-- enumerate the identity of the current bidder.
CREATE OR REPLACE VIEW public.auction_item_public_state AS
SELECT
  id,
  event_id,
  title,
  description,
  starting_bid,
  current_highest_bid,
  bid_increment_cents,
  end_time,
  is_closed,
  created_at
FROM public.auction_items;

GRANT SELECT ON public.auction_item_public_state TO anon, authenticated;

-- Direct reads would expose highest_bidder_id because Postgres RLS is row-level,
-- not column-level. Attendees use auction_item_public_state instead.
REVOKE SELECT ON public.auction_items FROM anon, authenticated;

CREATE POLICY "Anyone can read sanitized auction updates"
  ON public.auction_item_updates FOR SELECT
  TO anon, authenticated
  USING (TRUE);
