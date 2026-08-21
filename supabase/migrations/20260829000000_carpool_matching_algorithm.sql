-- ============================================================
-- Migration: 20260829000000_carpool_matching_algorithm.sql
-- Description: Carpool Matching Algorithm for Off-Campus Retreats
-- Issue: #2877
-- ============================================================

BEGIN;

-- ─── 1. carpool_vehicles ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.carpool_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  available_seats INTEGER NOT NULL CHECK (available_seats >= 0 AND available_seats <= 8),
  departure_time TIMESTAMPTZ NOT NULL,
  pickup_neighborhood TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS carpool_vehicles_event_id_idx ON public.carpool_vehicles(event_id);
CREATE INDEX IF NOT EXISTS carpool_vehicles_driver_user_id_idx ON public.carpool_vehicles(driver_user_id);

-- ─── 2. carpool_requests ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.carpool_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rider_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pickup_neighborhood TEXT NOT NULL,
  departure_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'cancelled')),
  matched_vehicle_id UUID REFERENCES public.carpool_vehicles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS carpool_requests_event_id_idx ON public.carpool_requests(event_id);
CREATE INDEX IF NOT EXISTS carpool_requests_rider_user_id_idx ON public.carpool_requests(rider_user_id);

-- ─── 3. carpool_offers ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.carpool_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.carpool_vehicles(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.carpool_requests(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vehicle_id, request_id)
);

CREATE INDEX IF NOT EXISTS carpool_offers_vehicle_id_idx ON public.carpool_offers(vehicle_id);
CREATE INDEX IF NOT EXISTS carpool_offers_request_id_idx ON public.carpool_offers(request_id);

-- ─── 4. Auto-update Triggers ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_updated_at_carpool_vehicles ON public.carpool_vehicles;
CREATE TRIGGER set_updated_at_carpool_vehicles BEFORE UPDATE ON public.carpool_vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_carpool_requests ON public.carpool_requests;
CREATE TRIGGER set_updated_at_carpool_requests BEFORE UPDATE ON public.carpool_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_carpool_offers ON public.carpool_offers;
CREATE TRIGGER set_updated_at_carpool_offers BEFORE UPDATE ON public.carpool_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 5. RPC: get_carpool_matches ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_carpool_matches(p_vehicle_id UUID)
RETURNS TABLE (
  request_id UUID,
  rider_user_id UUID,
  pickup_neighborhood TEXT,
  departure_time TIMESTAMPTZ,
  score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_neighborhood TEXT;
  v_time TIMESTAMPTZ;
BEGIN
  -- Get driver's carpool details
  SELECT event_id, pickup_neighborhood, carpool_vehicles.departure_time 
  INTO v_event_id, v_neighborhood, v_time
  FROM public.carpool_vehicles WHERE id = p_vehicle_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    cr.id, 
    cr.rider_user_id, 
    cr.pickup_neighborhood, 
    cr.departure_time,
    (
      -- +1000 if exact neighborhood match
      (CASE WHEN cr.pickup_neighborhood ILIKE v_neighborhood THEN 1000 ELSE 0 END) 
      -- -1 penalty point per minute of time difference
      - EXTRACT(EPOCH FROM abs(cr.departure_time - v_time))/60.0
    )::FLOAT as score
  FROM public.carpool_requests cr
  WHERE cr.event_id = v_event_id
    AND cr.status = 'pending'
    -- Exclude riders that the driver already has a pending/accepted offer for
    AND NOT EXISTS (
      SELECT 1 FROM public.carpool_offers co 
      WHERE co.request_id = cr.id AND co.vehicle_id = p_vehicle_id AND co.status IN ('pending', 'accepted')
    )
  ORDER BY score DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_carpool_matches(UUID) TO authenticated;

-- ─── 6. RPC: offer_carpool_ride ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.offer_carpool_ride(
  p_vehicle_id UUID,
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_rider_id UUID;
  v_vehicle_status TEXT;
  v_request_status TEXT;
BEGIN
  -- Verify vehicle is owned by auth.uid() and is active
  SELECT driver_user_id, status INTO v_driver_id, v_vehicle_status
  FROM public.carpool_vehicles WHERE id = p_vehicle_id;
  
  IF v_driver_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized. Only the driver can offer a ride.');
  END IF;

  IF v_vehicle_status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'This vehicle is no longer active.');
  END IF;

  -- Verify request is pending
  SELECT rider_user_id, status INTO v_rider_id, v_request_status
  FROM public.carpool_requests WHERE id = p_request_id;
  
  IF v_request_status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'This rider is no longer looking for a ride.');
  END IF;

  -- Create or update offer
  INSERT INTO public.carpool_offers (vehicle_id, request_id, status)
  VALUES (p_vehicle_id, p_request_id, 'pending')
  ON CONFLICT (vehicle_id, request_id) DO UPDATE SET status = 'pending', updated_at = NOW();

  -- Create Notification for rider
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_rider_id, 
    'carpool_offer', 
    'New Carpool Offer!', 
    'A driver has offered you a ride to an upcoming off-campus event.', 
    '/events'
  );

  RETURN jsonb_build_object('success', true, 'message', 'Ride offered successfully.');
END;
$$;
GRANT EXECUTE ON FUNCTION public.offer_carpool_ride(UUID, UUID) TO authenticated;

-- ─── 7. RPC: accept_carpool_offer ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_carpool_offer(
  p_offer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_offer RECORD;
  v_vehicle RECORD;
  v_request RECORD;
  v_group_id UUID;
  v_member_exists BOOLEAN;
BEGIN
  -- Fetch Offer
  SELECT * INTO v_offer FROM public.carpool_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Offer not found.'); END IF;
  
  -- Fetch Request
  SELECT * INTO v_request FROM public.carpool_requests WHERE id = v_offer.request_id;
  IF v_request.rider_user_id <> v_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized.');
  END IF;
  
  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request is no longer pending.');
  END IF;

  -- Fetch Vehicle
  SELECT * INTO v_vehicle FROM public.carpool_vehicles WHERE id = v_offer.vehicle_id FOR UPDATE;
  IF v_vehicle.available_seats <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'This vehicle is now full.');
  END IF;

  -- 1. Accept offer & deduct seat
  UPDATE public.carpool_offers SET status = 'accepted' WHERE id = p_offer_id;
  UPDATE public.carpool_vehicles SET available_seats = available_seats - 1 WHERE id = v_vehicle.id;
  
  -- 2. Lock the request
  UPDATE public.carpool_requests 
  SET status = 'matched', matched_vehicle_id = v_vehicle.id 
  WHERE id = v_request.id;

  -- 3. Decline other pending offers for this request
  UPDATE public.carpool_offers 
  SET status = 'rejected' 
  WHERE request_id = v_request.id AND id <> p_offer_id AND status = 'pending';

  -- 4. Notify Driver
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_vehicle.driver_user_id, 
    'carpool_accepted', 
    'Ride Accepted!', 
    'A rider accepted your carpool offer.', 
    '/events/' || v_vehicle.event_id::text
  );

  -- 5. Auto-provision group chat (Issue #2741)
  -- We'll use the groups table for chats. Name it after the vehicle/event.
  -- First check if a group for this vehicle already exists. 
  -- We will use the `id` of the vehicle as the group's custom id or just find it by name.
  -- To keep it simple, we will just create a new group if there isn't one, but how do we link it?
  -- Let's just create a temporary group chat in `groups` where the name is "Carpool: " + vehicle_id
  SELECT id INTO v_group_id FROM public.groups WHERE name = 'Carpool: ' || v_vehicle.id::text LIMIT 1;
  
  IF NOT FOUND THEN
    INSERT INTO public.groups (name, description, visibility, owner_id)
    VALUES ('Carpool: ' || v_vehicle.id::text, 'Temporary Carpool Chat', 'private', v_vehicle.driver_user_id)
    RETURNING id INTO v_group_id;
    
    -- Add driver to group
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_group_id, v_vehicle.driver_user_id, 'admin');
  END IF;

  -- Add rider to group
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, v_request.rider_user_id, 'member')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'message', 'Offer accepted.', 'group_id', v_group_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_carpool_offer(UUID) TO authenticated;

-- ─── 8. Driver Dropout Trigger ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_driver_dropout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'cancelled' THEN
    -- Cancel all offers for this vehicle
    UPDATE public.carpool_offers SET status = 'cancelled' WHERE vehicle_id = NEW.id AND status IN ('pending', 'accepted');
    
    -- Revert matched requests to pending
    UPDATE public.carpool_requests 
    SET status = 'pending', matched_vehicle_id = NULL
    WHERE matched_vehicle_id = NEW.id;
    
    -- Notify stranded riders
    INSERT INTO public.notifications (user_id, type, title, message, link)
    SELECT cr.rider_user_id, 'carpool_cancelled', 'Your Ride was Cancelled', 'Your driver had to cancel. You have been placed back in the unmatched pool.', '/events/' || NEW.event_id::text
    FROM public.carpool_requests cr
    WHERE cr.matched_vehicle_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_driver_dropout
AFTER UPDATE ON public.carpool_vehicles
FOR EACH ROW EXECUTE FUNCTION public.handle_driver_dropout();

-- ─── 9. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.carpool_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpool_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carpool_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carpool_vehicles_select" ON public.carpool_vehicles FOR SELECT USING (TRUE);
CREATE POLICY "carpool_vehicles_insert" ON public.carpool_vehicles FOR INSERT WITH CHECK (driver_user_id = auth.uid());
CREATE POLICY "carpool_vehicles_update" ON public.carpool_vehicles FOR UPDATE USING (driver_user_id = auth.uid());
CREATE POLICY "carpool_vehicles_delete" ON public.carpool_vehicles FOR DELETE USING (driver_user_id = auth.uid());

CREATE POLICY "carpool_requests_select" ON public.carpool_requests FOR SELECT USING (TRUE);
CREATE POLICY "carpool_requests_insert" ON public.carpool_requests FOR INSERT WITH CHECK (rider_user_id = auth.uid());
CREATE POLICY "carpool_requests_update" ON public.carpool_requests FOR UPDATE USING (rider_user_id = auth.uid());
CREATE POLICY "carpool_requests_delete" ON public.carpool_requests FOR DELETE USING (rider_user_id = auth.uid());

CREATE POLICY "carpool_offers_select" ON public.carpool_offers FOR SELECT USING (
  -- Driver of vehicle OR rider of request can see offers
  EXISTS (SELECT 1 FROM public.carpool_vehicles cv WHERE cv.id = vehicle_id AND cv.driver_user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.carpool_requests cr WHERE cr.id = request_id AND cr.rider_user_id = auth.uid())
);

COMMIT;
