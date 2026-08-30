-- Migration: 20270323000000_room_noshow_reclaim.sql
-- Description: Schema and functions for Room Booking No-Show Reclaim & the
--              Waitlist Cascade (#4390).
--
-- During exam weeks every slot is gone within minutes of opening, yet a third
-- of those rooms sit dark. A booking is treated as permanent from the moment it
-- is made, so nothing checks whether anyone turned up and nothing hands the room
-- back. The waitlist never fires because, as far as the system is concerned,
-- nothing was ever released.
--
-- Every predicate below takes an explicit evaluation timestamp rather than
-- reading NOW(), so "was this booking abandoned at 14:05?" has a reproducible
-- answer in a test and in a replay of last Tuesday.

-- 1. Check-in against a booking. One row per booking; a second scan is a no-op.
CREATE TABLE IF NOT EXISTS room_booking_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES room_bookings(id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL CHECK (method IN ('QR_SCAN', 'DOOR_BADGE', 'MANUAL_STAFF')),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Offers of a reclaimed slot, in cascade order.
CREATE TABLE IF NOT EXISTS room_reclaim_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES room_bookings(id) ON DELETE CASCADE,
  room_id UUID NOT NULL,
  offered_to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  slot_starts_at TIMESTAMPTZ NOT NULL,
  slot_ends_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'OFFERED'
    CHECK (status IN ('OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED')),
  -- Nobody is offered the same freed slot twice.
  UNIQUE (booking_id, offered_to_user_id),
  CONSTRAINT reclaim_offer_window_is_positive CHECK (slot_ends_at > slot_starts_at),
  CONSTRAINT reclaim_offer_expiry_within_slot CHECK (expires_at <= slot_ends_at)
);

CREATE INDEX IF NOT EXISTS idx_reclaim_offers_pending
  ON room_reclaim_offers (expires_at)
  WHERE status = 'OFFERED';

CREATE INDEX IF NOT EXISTS idx_reclaim_offers_booking
  ON room_reclaim_offers (booking_id, offered_at);

-- 3. No-show tally, kept so repeat offenders can later be rate-limited.
--    Deliberately just a count: what the timetabling office does with it is a
--    policy decision, and baking a penalty in here would prejudge it.
CREATE TABLE IF NOT EXISTS room_no_show_counters (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  no_show_count INTEGER NOT NULL DEFAULT 0 CHECK (no_show_count >= 0),
  last_no_show_at TIMESTAMPTZ
);

-- 4. Grace scales with the slot rather than being a fixed constant.
--
--    Twenty minutes of grace on a thirty-minute slot gives away two thirds of
--    the booking to somebody who never showed; five minutes on a three-hour
--    booking punishes someone stuck behind a late lecture. A fifth of the slot,
--    clamped to [5, 20] minutes, is a defensible middle.
CREATE OR REPLACE FUNCTION room_booking_grace_minutes(
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LEAST(
    20,
    GREATEST(
      5,
      ROUND(EXTRACT(EPOCH FROM (p_ends_at - p_starts_at)) / 60 * 0.2)::INTEGER
    )
  );
$$;

CREATE OR REPLACE FUNCTION room_booking_grace_deadline(
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_starts_at
       + (room_booking_grace_minutes(p_starts_at, p_ends_at) * INTERVAL '1 minute');
$$;

-- 5. Bookings eligible for reclaim at a given instant.
--
--    A booking qualifies only when it is past its grace deadline, has no
--    check-in, is still active, and has enough time left to be worth handing on.
--    Reclaiming the last four minutes of a booking helps nobody and just churns
--    notifications at the waitlist.
CREATE OR REPLACE FUNCTION find_reclaimable_bookings(
  p_room_id UUID,
  p_evaluated_at TIMESTAMPTZ,
  p_min_usable_remaining_minutes INTEGER DEFAULT 20
)
RETURNS TABLE (
  booking_id UUID,
  holder_user_id UUID,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  grace_deadline TIMESTAMPTZ,
  remaining_minutes NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.user_id,
    b.starts_at,
    b.ends_at,
    room_booking_grace_deadline(b.starts_at, b.ends_at),
    ROUND(EXTRACT(EPOCH FROM (b.ends_at - p_evaluated_at)) / 60, 2)
  FROM room_bookings b
  WHERE b.room_id = p_room_id
    AND b.status = 'BOOKED'
    AND p_evaluated_at > room_booking_grace_deadline(b.starts_at, b.ends_at)
    AND NOT EXISTS (
      SELECT 1 FROM room_booking_checkins c WHERE c.booking_id = b.id
    )
    AND EXTRACT(EPOCH FROM (b.ends_at - p_evaluated_at)) / 60
        >= p_min_usable_remaining_minutes
  ORDER BY b.starts_at;
$$;

-- 6. Reclaim a booking and offer the remainder to the first waitlist candidate
--    who has not already been asked.
--
--    The offered window starts at the moment of reclaim, not at the original
--    booking start: the first twenty minutes are gone and promising them would
--    be a lie.
CREATE OR REPLACE FUNCTION reclaim_room_booking(
  p_booking_id UUID,
  p_evaluated_at TIMESTAMPTZ,
  p_offer_ttl_minutes INTEGER DEFAULT 10,
  p_min_usable_remaining_minutes INTEGER DEFAULT 20
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_candidate UUID;
  v_offer_id UUID;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_booking FROM room_bookings WHERE id = p_booking_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown booking %', p_booking_id;
  END IF;
  IF v_booking.status <> 'BOOKED' THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM room_booking_checkins WHERE booking_id = p_booking_id) THEN
    RETURN NULL;
  END IF;
  IF p_evaluated_at <= room_booking_grace_deadline(v_booking.starts_at, v_booking.ends_at) THEN
    RETURN NULL;
  END IF;
  IF EXTRACT(EPOCH FROM (v_booking.ends_at - p_evaluated_at)) / 60
     < p_min_usable_remaining_minutes THEN
    RETURN NULL;
  END IF;

  UPDATE room_bookings SET status = 'RECLAIMED' WHERE id = p_booking_id;

  INSERT INTO room_no_show_counters (user_id, no_show_count, last_no_show_at)
  VALUES (v_booking.user_id, 1, p_evaluated_at)
  ON CONFLICT (user_id) DO UPDATE
    SET no_show_count = room_no_show_counters.no_show_count + 1,
        last_no_show_at = p_evaluated_at;

  SELECT w.user_id INTO v_candidate
  FROM room_waitlist w
  WHERE w.room_id = v_booking.room_id
    AND w.user_id <> v_booking.user_id
    AND NOT EXISTS (
      SELECT 1 FROM room_reclaim_offers o
      WHERE o.booking_id = p_booking_id AND o.offered_to_user_id = w.user_id
    )
  ORDER BY w.position ASC, w.requested_at ASC
  LIMIT 1;

  IF v_candidate IS NULL THEN
    -- Waitlist empty or exhausted: the slot returns to general availability.
    RETURN NULL;
  END IF;

  v_expires := LEAST(
    p_evaluated_at + (p_offer_ttl_minutes * INTERVAL '1 minute'),
    v_booking.ends_at
  );

  INSERT INTO room_reclaim_offers (
    booking_id, room_id, offered_to_user_id, offered_at,
    expires_at, slot_starts_at, slot_ends_at, status
  )
  VALUES (
    p_booking_id, v_booking.room_id, v_candidate, p_evaluated_at,
    v_expires, p_evaluated_at, v_booking.ends_at, 'OFFERED'
  )
  RETURNING id INTO v_offer_id;

  RETURN v_offer_id;
END;
$$;

-- 7. Expire stale offers and cascade each one onward.
--
--    A silent expiry with no cascade would leave the room empty for exactly the
--    reason this feature exists, so expiring and re-offering are one operation.
CREATE OR REPLACE FUNCTION cascade_expired_reclaim_offers(
  p_evaluated_at TIMESTAMPTZ,
  p_offer_ttl_minutes INTEGER DEFAULT 10
)
RETURNS TABLE (expired_offer_id UUID, next_offer_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer RECORD;
  v_candidate UUID;
  v_next UUID;
  v_expires TIMESTAMPTZ;
BEGIN
  FOR v_offer IN
    SELECT * FROM room_reclaim_offers
    WHERE status = 'OFFERED' AND expires_at < p_evaluated_at
    ORDER BY expires_at ASC
    FOR UPDATE
  LOOP
    UPDATE room_reclaim_offers SET status = 'EXPIRED' WHERE id = v_offer.id;
    v_next := NULL;

    -- Only cascade while the remainder is still worth having.
    IF EXTRACT(EPOCH FROM (v_offer.slot_ends_at - p_evaluated_at)) / 60 >= 20 THEN
      SELECT w.user_id INTO v_candidate
      FROM room_waitlist w
      WHERE w.room_id = v_offer.room_id
        AND NOT EXISTS (
          SELECT 1 FROM room_reclaim_offers o
          WHERE o.booking_id = v_offer.booking_id AND o.offered_to_user_id = w.user_id
        )
      ORDER BY w.position ASC, w.requested_at ASC
      LIMIT 1;

      IF v_candidate IS NOT NULL THEN
        v_expires := LEAST(
          p_evaluated_at + (p_offer_ttl_minutes * INTERVAL '1 minute'),
          v_offer.slot_ends_at
        );

        INSERT INTO room_reclaim_offers (
          booking_id, room_id, offered_to_user_id, offered_at,
          expires_at, slot_starts_at, slot_ends_at, status
        )
        VALUES (
          v_offer.booking_id, v_offer.room_id, v_candidate, p_evaluated_at,
          v_expires, p_evaluated_at, v_offer.slot_ends_at, 'OFFERED'
        )
        RETURNING id INTO v_next;
      END IF;
    END IF;

    expired_offer_id := v_offer.id;
    next_offer_id := v_next;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 8. Accept an offer, converting it into a real booking for the remainder.
CREATE OR REPLACE FUNCTION accept_reclaim_offer(p_offer_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer RECORD;
  v_booking_id UUID;
BEGIN
  SELECT * INTO v_offer FROM room_reclaim_offers WHERE id = p_offer_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown reclaim offer %', p_offer_id;
  END IF;
  IF v_offer.offered_to_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'This offer belongs to someone else.';
  END IF;
  IF v_offer.status <> 'OFFERED' THEN
    RAISE EXCEPTION 'Offer % is % and can no longer be accepted.', p_offer_id, v_offer.status;
  END IF;
  IF NOW() > v_offer.expires_at THEN
    UPDATE room_reclaim_offers SET status = 'EXPIRED' WHERE id = p_offer_id;
    RAISE EXCEPTION 'Offer % expired at %.', p_offer_id, v_offer.expires_at;
  END IF;

  UPDATE room_reclaim_offers SET status = 'ACCEPTED' WHERE id = p_offer_id;

  DELETE FROM room_waitlist
  WHERE room_id = v_offer.room_id AND user_id = v_offer.offered_to_user_id;

  INSERT INTO room_bookings (room_id, user_id, starts_at, ends_at, status)
  VALUES (
    v_offer.room_id, v_offer.offered_to_user_id,
    v_offer.slot_starts_at, v_offer.slot_ends_at, 'BOOKED'
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

-- 9. Row level security.
ALTER TABLE room_booking_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_reclaim_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_no_show_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS room_checkins_owner_read ON room_booking_checkins;
CREATE POLICY room_checkins_owner_read ON room_booking_checkins
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_bookings b
      WHERE b.id = room_booking_checkins.booking_id AND b.user_id = auth.uid()
    )
  );

-- A candidate sees the offer made to them and nobody else's.
DROP POLICY IF EXISTS room_offers_recipient_read ON room_reclaim_offers;
CREATE POLICY room_offers_recipient_read ON room_reclaim_offers
  FOR SELECT TO authenticated
  USING (offered_to_user_id = auth.uid());

DROP POLICY IF EXISTS room_no_show_self_read ON room_no_show_counters;
CREATE POLICY room_no_show_self_read ON room_no_show_counters
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT EXECUTE ON FUNCTION room_booking_grace_minutes(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION room_booking_grace_deadline(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION find_reclaimable_bookings(UUID, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_reclaim_offer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reclaim_room_booking(UUID, TIMESTAMPTZ, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cascade_expired_reclaim_offers(TIMESTAMPTZ, INTEGER) TO service_role;

COMMENT ON FUNCTION find_reclaimable_bookings(UUID, TIMESTAMPTZ, INTEGER) IS
  'Pure over the supplied evaluation timestamp; deliberately does not read NOW() so reclaim decisions are reproducible.';
