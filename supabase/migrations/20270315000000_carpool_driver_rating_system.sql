-- Migration: 20270315000000_carpool_driver_rating_system.sql
-- Description: Dynamic Carpool Driver Rating and Reputation System (Issue #4536)
-- Adds 1-5 star driver reviews, reputation aggregation, and automated blocking
-- when a driver's average drops below 3.0 stars (minimum 3 ratings).

-- 1. Add carpool reputation and safety block columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS carpool_driver_rating NUMERIC(3,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS carpool_driver_rating_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_carpool_driver_blocked BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS carpool_driver_blocked_reason TEXT DEFAULT NULL;

-- 2. Create carpool_driver_ratings table
CREATE TABLE IF NOT EXISTS public.carpool_driver_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.carpool_vehicles(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rider_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  safety_tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT carpool_driver_ratings_unique_rider_vehicle UNIQUE (vehicle_id, rider_user_id),
  CONSTRAINT carpool_driver_ratings_no_self_rate CHECK (driver_user_id <> rider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_carpool_driver_ratings_driver ON public.carpool_driver_ratings(driver_user_id);
CREATE INDEX IF NOT EXISTS idx_carpool_driver_ratings_vehicle ON public.carpool_driver_ratings(vehicle_id);

-- Enable RLS
ALTER TABLE public.carpool_driver_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view driver ratings" ON public.carpool_driver_ratings;
CREATE POLICY "Anyone authenticated can view driver ratings"
  ON public.carpool_driver_ratings FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Riders can insert their own rating" ON public.carpool_driver_ratings;
CREATE POLICY "Riders can insert their own rating"
  ON public.carpool_driver_ratings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = rider_user_id);

-- 3. RPC to submit a driver rating and automatically trigger reputation aggregation & blocking
CREATE OR REPLACE FUNCTION public.submit_carpool_driver_rating(
  p_vehicle_id UUID,
  p_rating INTEGER,
  p_feedback TEXT DEFAULT NULL,
  p_safety_tags TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider_id UUID := auth.uid();
  v_driver_id UUID;
  v_avg_rating NUMERIC(3,2);
  v_rating_count INTEGER;
  v_is_blocked BOOLEAN := FALSE;
  v_blocked_reason TEXT := NULL;
BEGIN
  IF v_rider_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Authentication required.');
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Rating must be between 1 and 5 stars.');
  END IF;

  -- Lookup driver for this vehicle
  SELECT driver_user_id INTO v_driver_id
  FROM public.carpool_vehicles
  WHERE id = p_vehicle_id;

  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Carpool vehicle not found.');
  END IF;

  IF v_driver_id = v_rider_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Drivers cannot rate their own rides.');
  END IF;

  -- Insert rating record
  INSERT INTO public.carpool_driver_ratings (
    vehicle_id, driver_user_id, rider_user_id, rating, feedback, safety_tags
  )
  VALUES (
    p_vehicle_id, v_driver_id, v_rider_id, p_rating, p_feedback, p_safety_tags
  )
  ON CONFLICT (vehicle_id, rider_user_id) DO UPDATE SET
    rating = EXCLUDED.rating,
    feedback = EXCLUDED.feedback,
    safety_tags = EXCLUDED.safety_tags,
    created_at = NOW();

  -- Recalculate aggregated stats for this driver
  SELECT 
    ROUND(AVG(rating), 2),
    COUNT(*)::INTEGER
  INTO v_avg_rating, v_rating_count
  FROM public.carpool_driver_ratings
  WHERE driver_user_id = v_driver_id;

  -- Check automated block condition: minimum 3 trips and average < 3.0
  IF v_rating_count >= 3 AND v_avg_rating < 3.0 THEN
    v_is_blocked := TRUE;
    v_blocked_reason := 'Automated safety block: Driver average rating (' || v_avg_rating || '/5.0) fell below 3.0 stars across ' || v_rating_count || ' trips.';
    
    -- Cancel active vehicles for this driver
    UPDATE public.carpool_vehicles
    SET status = 'cancelled'
    WHERE driver_user_id = v_driver_id AND status = 'active';
  END IF;

  -- Update driver profile with new rating stats and block status
  UPDATE public.profiles
  SET 
    carpool_driver_rating = v_avg_rating,
    carpool_driver_rating_count = v_rating_count,
    is_carpool_driver_blocked = v_is_blocked,
    carpool_driver_blocked_reason = v_blocked_reason,
    updated_at = NOW()
  WHERE id = v_driver_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Driver rating submitted successfully.',
    'average_rating', v_avg_rating,
    'total_ratings', v_rating_count,
    'is_blocked', v_is_blocked
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_carpool_driver_rating(UUID, INTEGER, TEXT, TEXT[]) TO authenticated;

-- 4. Enforce block in offer_carpool_ride
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
  v_is_blocked BOOLEAN;
BEGIN
  -- Verify driver is not blocked due to poor ratings
  SELECT is_carpool_driver_blocked INTO v_is_blocked
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_is_blocked IS TRUE THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'You are permanently blocked from offering rides due to low passenger safety ratings (< 3.0 stars).'
    );
  END IF;

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

-- 5. Add RPC to decline/reject a carpool offer
CREATE OR REPLACE FUNCTION public.decline_carpool_offer(
  p_offer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request RECORD;
BEGIN
  -- Verify rider ownership
  SELECT cr.* INTO v_request
  FROM public.carpool_offers co
  JOIN public.carpool_requests cr ON cr.id = co.request_id
  WHERE co.id = p_offer_id;

  IF NOT FOUND OR v_request.rider_user_id <> v_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized.');
  END IF;

  UPDATE public.carpool_offers
  SET status = 'rejected', updated_at = NOW()
  WHERE id = p_offer_id;

  RETURN jsonb_build_object('success', true, 'message', 'Offer declined.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_carpool_offer(UUID) TO authenticated;
