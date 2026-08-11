-- ============================================================
-- Migration: 20260809120000_carpooling_off_campus.sql
-- Description: Carpooling to Off-Campus Events coordination module.
--   - carpools            (event_id, driver_id, capacity, departure_time, meeting_point)
--   - carpool_passengers  (carpool_id, passenger_id)
--   - carpool_chats       (auto-provisioned group chat per carpool)
--   - carpool_chat_messages
--   - RPCs: offer_carpool, claim_carpool_seat, leave_carpool, cancel_carpool
-- Issue: #2748
-- ============================================================

BEGIN;

-- ─── 1. carpools ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.carpools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  capacity INTEGER NOT NULL CHECK (capacity > 0 AND capacity <= 8),
  departure_time TIMESTAMPTZ NOT NULL,
  meeting_point TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS carpools_event_id_idx ON public.carpools(event_id);
CREATE INDEX IF NOT EXISTS carpools_driver_id_idx ON public.carpools(driver_id);

DROP TRIGGER IF EXISTS set_updated_at_carpools ON public.carpools;
CREATE TRIGGER set_updated_at_carpools
BEFORE UPDATE ON public.carpools
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 2. carpool_passengers ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.carpool_passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carpool_id UUID NOT NULL REFERENCES public.carpools(id) ON DELETE CASCADE,
  passenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seat_claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (carpool_id, passenger_id)
);

CREATE INDEX IF NOT EXISTS carpool_passengers_carpool_id_idx ON public.carpool_passengers(carpool_id);
CREATE INDEX IF NOT EXISTS carpool_passengers_passenger_id_idx ON public.carpool_passengers(passenger_id);

-- ─── 3. Auto-provisioned group chat per carpool ────────────────────────────

CREATE TABLE IF NOT EXISTS public.carpool_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carpool_id UUID NOT NULL REFERENCES public.carpools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (carpool_id)
);

CREATE TABLE IF NOT EXISTS public.carpool_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carpool_chat_id UUID NOT NULL REFERENCES public.carpool_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS carpool_chat_messages_chat_id_idx ON public.carpool_chat_messages(carpool_chat_id);

-- ─── 4. Membership helper ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_carpool_member(p_carpool_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_driver BOOLEAN;
  v_is_passenger BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.carpools WHERE id = p_carpool_id AND driver_id = p_user_id)
  INTO v_is_driver;
  IF v_is_driver THEN
    RETURN TRUE;
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.carpool_passengers WHERE carpool_id = p_carpool_id AND passenger_id = p_user_id)
  INTO v_is_passenger;
  RETURN v_is_passenger;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_carpool_member(UUID, UUID) TO authenticated;

-- ─── 5. Capacity enforcement trigger ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_carpool_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity INTEGER;
  v_status TEXT;
  v_driver_id UUID;
  v_count INTEGER;
BEGIN
  SELECT capacity, status, driver_id
  INTO v_capacity, v_status, v_driver_id
  FROM public.carpools
  WHERE id = NEW.carpool_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carpool does not exist' USING ERRCODE = 'P0001';
  END IF;

  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Carpool is no longer active' USING ERRCODE = 'P0001';
  END IF;

  IF v_driver_id = NEW.passenger_id THEN
    RAISE EXCEPTION 'Driver cannot claim a seat in their own carpool' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.carpool_passengers
  WHERE carpool_id = NEW.carpool_id;

  IF v_count >= v_capacity THEN
    RAISE EXCEPTION 'Carpool is full' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_carpool_capacity ON public.carpool_passengers;
CREATE TRIGGER trg_enforce_carpool_capacity
BEFORE INSERT ON public.carpool_passengers
FOR EACH ROW EXECUTE FUNCTION public.enforce_carpool_capacity();

-- ─── 6. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.carpools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpool_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpool_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpool_chat_messages ENABLE ROW LEVEL SECURITY;

-- carpools: everyone can view; driver manages their own carpool
CREATE POLICY "carpools_select" ON public.carpools FOR SELECT USING (TRUE);
CREATE POLICY "carpools_insert" ON public.carpools FOR INSERT WITH CHECK (driver_id = auth.uid());
CREATE POLICY "carpools_update_driver" ON public.carpools FOR UPDATE USING (driver_id = auth.uid());
CREATE POLICY "carpools_delete_driver" ON public.carpools FOR DELETE USING (driver_id = auth.uid());

-- carpool_passengers: everyone can view; seats are managed through the RPCs
-- (SECURITY DEFINER bypasses RLS); users can release their own seat directly.
CREATE POLICY "carpool_passengers_select" ON public.carpool_passengers FOR SELECT USING (TRUE);
CREATE POLICY "carpool_passengers_delete_own"
  ON public.carpool_passengers FOR DELETE
  USING (passenger_id = auth.uid());

-- carpool_chats: only carpool members can view the auto-provisioned chat
CREATE POLICY "carpool_chats_select_member"
  ON public.carpool_chats FOR SELECT
  USING (public.is_carpool_member(carpool_id, auth.uid()));

-- carpool_chat_messages: only members can read or send messages
CREATE POLICY "carpool_chat_messages_select_member"
  ON public.carpool_chat_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.carpool_chats cc
    WHERE cc.id = carpool_chat_messages.carpool_chat_id
      AND public.is_carpool_member(cc.carpool_id, auth.uid())
  ));
CREATE POLICY "carpool_chat_messages_insert_member"
  ON public.carpool_chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.carpool_chats cc
      WHERE cc.id = carpool_chat_messages.carpool_chat_id
        AND public.is_carpool_member(cc.carpool_id, auth.uid())
    )
  );

-- ─── 7. RPCs ───────────────────────────────────────────────────────────────

-- offer_carpool: create a carpool and auto-provision its group chat
CREATE OR REPLACE FUNCTION public.offer_carpool(
  p_event_id UUID,
  p_capacity INTEGER,
  p_departure_time TIMESTAMPTZ,
  p_meeting_point TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID := auth.uid();
  v_carpool_id UUID;
BEGIN
  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED', 'message', 'You must be signed in to offer a ride');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Event not found');
  END IF;

  IF p_capacity <= 0 OR p_capacity > 8 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_CAPACITY', 'message', 'Capacity must be between 1 and 8 seats');
  END IF;

  INSERT INTO public.carpools (event_id, driver_id, capacity, departure_time, meeting_point, notes)
  VALUES (p_event_id, v_driver_id, p_capacity, p_departure_time, p_meeting_point, p_notes)
  RETURNING id INTO v_carpool_id;

  INSERT INTO public.carpool_chats (carpool_id, created_by)
  VALUES (v_carpool_id, v_driver_id);

  RETURN jsonb_build_object(
    'success', true,
    'code', 'OFFERED',
    'message', 'Ride offered and group chat provisioned',
    'carpool_id', v_carpool_id
  );
END;
$$;

-- claim_carpool_seat: concurrency-safe seat claim up to capacity
CREATE OR REPLACE FUNCTION public.claim_carpool_seat(
  p_carpool_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_lock_key INT;
  v_has_claimed BOOLEAN;
  v_capacity INTEGER;
  v_status TEXT;
  v_driver_id UUID;
  v_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED', 'message', 'You must be signed in to claim a seat');
  END IF;

  v_lock_key := ('x' || substr(md5('carpool_' || p_carpool_id::text), 1, 8))::bit(32)::int;
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RETURN jsonb_build_object('success', false, 'code', 'BUSY', 'message', 'Server busy, please retry');
  END IF;

  SELECT capacity, status, driver_id
  INTO v_capacity, v_status, v_driver_id
  FROM public.carpools
  WHERE id = p_carpool_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Carpool not found');
  END IF;

  IF v_status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'code', 'CANCELLED', 'message', 'This carpool is no longer active');
  END IF;

  IF v_driver_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'IS_DRIVER', 'message', 'You are the driver of this carpool');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.carpool_passengers
    WHERE carpool_id = p_carpool_id AND passenger_id = v_user_id
  ) INTO v_has_claimed;
  IF v_has_claimed THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_CLAIMED', 'message', 'You already have a seat in this carpool');
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.carpool_passengers
  WHERE carpool_id = p_carpool_id;

  IF v_count >= v_capacity THEN
    RETURN jsonb_build_object('success', false, 'code', 'FULL', 'message', 'This carpool is full');
  END IF;

  INSERT INTO public.carpool_passengers (carpool_id, passenger_id)
  VALUES (p_carpool_id, v_user_id);

  RETURN jsonb_build_object('success', true, 'code', 'CLAIMED', 'message', 'Seat claimed');
END;
$$;

-- leave_carpool: passenger removes their own seat
CREATE OR REPLACE FUNCTION public.leave_carpool(
  p_carpool_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED', 'message', 'You must be signed in');
  END IF;

  DELETE FROM public.carpool_passengers
  WHERE carpool_id = p_carpool_id AND passenger_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_CLAIMED', 'message', 'You do not have a seat in this carpool');
  END IF;

  RETURN jsonb_build_object('success', true, 'code', 'LEFT', 'message', 'You left the carpool');
END;
$$;

-- cancel_carpool: driver cancels and every attached passenger is notified in-app
CREATE OR REPLACE FUNCTION public.cancel_carpool(
  p_carpool_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_event_id UUID;
  v_driver_name TEXT;
  v_notified INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED', 'message', 'You must be signed in');
  END IF;

  UPDATE public.carpools
  SET status = 'cancelled'
  WHERE id = p_carpool_id AND driver_id = v_user_id
  RETURNING event_id INTO v_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_OWNER', 'message', 'Only the driver can cancel this carpool');
  END IF;

  SELECT COALESCE(full_name, 'a driver') INTO v_driver_name
  FROM public.profiles
  WHERE id = v_user_id;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  SELECT
    cp.passenger_id,
    'carpool',
    'Carpool cancelled',
    'The carpool you joined for this event was cancelled by ' || v_driver_name || '. Please make alternate travel plans.',
    '/events/' || v_event_id::text
  FROM public.carpool_passengers cp
  WHERE cp.carpool_id = p_carpool_id
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_notified = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'CANCELLED',
    'message', 'Carpool cancelled',
    'notified', v_notified
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.offer_carpool(UUID, INTEGER, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_carpool_seat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_carpool(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_carpool(UUID) TO authenticated;

-- ─── 8. Realtime ───────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'carpools'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.carpools;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'carpool_passengers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.carpool_passengers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'carpool_chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.carpool_chat_messages;
  END IF;
END;
$$;

COMMIT;
