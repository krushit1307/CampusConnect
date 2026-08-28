-- Migration: 20270317000000_interactive_campus_safety_escort_map.sql
-- Description: Schema and Supabase Realtime channel setup for Interactive Campus Safety Escort Map (#4256)

-- 1. Create safety_escort_requests table
CREATE TABLE IF NOT EXISTS safety_escort_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  pickup_latitude DECIMAL(10, 7) NOT NULL,
  pickup_longitude DECIMAL(10, 7) NOT NULL,
  pickup_location_name VARCHAR(255) NOT NULL,
  destination_location_name VARCHAR(255) NOT NULL,
  officer_id UUID,
  officer_name VARCHAR(255),
  current_officer_lat DECIMAL(10, 7),
  current_officer_lng DECIMAL(10, 7),
  status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED', -- 'REQUESTED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED'
  estimated_eta_minutes INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for active escort requests
CREATE INDEX IF NOT EXISTS idx_safety_escort_status ON safety_escort_requests(status);

-- Enable Supabase Realtime for safety_escort_requests
ALTER PUBLICATION supabase_realtime ADD TABLE safety_escort_requests;

-- 2. Stored Procedure: Update Officer GPS Telemetry Stream & Recalculate ETA
CREATE OR REPLACE FUNCTION update_safety_officer_gps(
  p_escort_id UUID,
  p_officer_lat DECIMAL(10, 7),
  p_officer_lng DECIMAL(10, 7)
)
RETURNS TABLE (
  escort_id UUID,
  updated_status VARCHAR(50),
  eta_minutes INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_escort RECORD;
  v_dist_miles DECIMAL(10, 2);
  v_eta INT;
BEGIN
  SELECT * INTO v_escort FROM safety_escort_requests WHERE id = p_escort_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escort request record not found.';
  END IF;

  -- Calculate approximate Haversine distance in miles
  v_dist_miles := (
    3958.8 * 2 * asin(sqrt(
      sin(radians(v_escort.pickup_latitude - p_officer_lat) / 2)^2 +
      cos(radians(p_officer_lat)) * cos(radians(v_escort.pickup_latitude)) *
      sin(radians(v_escort.pickup_longitude - p_officer_lng) / 2)^2
    ))
  );

  -- Estimate ETA based on 15 mph campus escort vehicle speed (4 minutes per mile)
  v_eta := Greatest(1, Round(v_dist_miles * 4.0));

  UPDATE safety_escort_requests
  SET current_officer_lat = p_officer_lat,
      current_officer_lng = p_officer_lng,
      estimated_eta_minutes = v_eta,
      status = CASE WHEN v_dist_miles < 0.02 THEN 'ARRIVED' ELSE 'EN_ROUTE' END,
      updated_at = NOW()
  WHERE id = p_escort_id;

  RETURN QUERY SELECT p_escort_id, CASE WHEN v_dist_miles < 0.02 THEN 'ARRIVED'::VARCHAR ELSE 'EN_ROUTE'::VARCHAR END, v_eta;
END;
$$;
