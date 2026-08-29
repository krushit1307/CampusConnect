-- Migration: 20260847000000_event_carbon_footprint.sql
-- Description: Dynamic Event Carbon Footprint Estimator with Green Event badges (#3590)

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS carbon_kg_estimate NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_green_certified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS venue_sqft NUMERIC(10, 2) DEFAULT 1500,
ADD COLUMN IF NOT EXISTS catering_type TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS sustainable_mitigations TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.events.carbon_kg_estimate IS 'Estimated total CO2 emissions in kg';
COMMENT ON COLUMN public.events.is_green_certified IS 'Awarded to events with low carbon intensity (<= 1.5kg CO2/attendee)';

-- RPC to mathematically calculate event carbon footprint
CREATE OR REPLACE FUNCTION public.calculate_event_footprint(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event RECORD;
  v_attendee_count INT;
  v_duration_hours NUMERIC;
  v_venue_sqft NUMERIC;
  v_venue_co2 NUMERIC;
  v_transit_co2 NUMERIC;
  v_catering_co2 NUMERIC;
  v_raw_total NUMERIC;
  v_mitigation_count INT;
  v_mitigation_discount NUMERIC;
  v_mitigation_savings NUMERIC;
  v_final_total NUMERIC;
  v_co2_per_attendee NUMERIC;
  v_is_green BOOLEAN;
BEGIN
  -- Fetch event
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Event not found');
  END IF;

  -- Count confirmed attendees
  SELECT COUNT(*) INTO v_attendee_count 
  FROM public.event_rsvps 
  WHERE event_id = p_event_id AND LOWER(status) IN ('going', 'attended', 'confirmed');
  
  IF v_attendee_count = 0 THEN
    v_attendee_count := COALESCE(v_event.capacity, 50);
  END IF;

  -- Calculate duration in hours
  v_duration_hours := GREATEST(1.0, EXTRACT(EPOCH FROM (v_event.end_time - v_event.start_time)) / 3600.0);
  v_venue_sqft := COALESCE(v_event.venue_sqft, 1500);

  -- 1. Venue HVAC & Lighting Emissions (0.12 kg CO2 / sqft-hour)
  v_venue_co2 := ROUND((v_venue_sqft * v_duration_hours * 0.12)::numeric, 2);

  -- 2. Attendee Transit Emissions (assuming 35% commuters @ 2.4kg, 65% dorm @ 0.2kg = ~0.97 kg/attendee)
  v_transit_co2 := ROUND((v_attendee_count * (0.35 * 2.4 + 0.65 * 0.2))::numeric, 2);

  -- 3. Catering Emissions
  v_catering_co2 := CASE LOWER(COALESCE(v_event.catering_type, 'standard'))
    WHEN 'vegan' THEN ROUND((v_attendee_count * 0.5)::numeric, 2)
    WHEN 'vegetarian' THEN ROUND((v_attendee_count * 1.2)::numeric, 2)
    WHEN 'zero_waste' THEN ROUND((v_attendee_count * 1.0)::numeric, 2)
    WHEN 'none' THEN 0.0
    ELSE ROUND((v_attendee_count * 3.5)::numeric, 2)
  END;

  v_raw_total := v_venue_co2 + v_transit_co2 + v_catering_co2;

  -- 4. Sustainable Mitigations Reduction (15% per mitigation up to 60%)
  v_mitigation_count := COALESCE(array_length(v_event.sustainable_mitigations, 1), 0);
  v_mitigation_discount := LEAST(0.60, v_mitigation_count * 0.15);
  v_mitigation_savings := ROUND((v_raw_total * v_mitigation_discount)::numeric, 2);
  v_final_total := ROUND((v_raw_total - v_mitigation_savings)::numeric, 2);

  -- Metric per attendee
  v_co2_per_attendee := ROUND((v_final_total / GREATEST(1, v_attendee_count))::numeric, 2);
  v_is_green := v_co2_per_attendee <= 1.5;

  -- Update event record
  UPDATE public.events
  SET 
    carbon_kg_estimate = v_final_total,
    is_green_certified = v_is_green
  WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'venue_co2_kg', v_venue_co2,
    'transit_co2_kg', v_transit_co2,
    'catering_co2_kg', v_catering_co2,
    'mitigation_savings_kg', v_mitigation_savings,
    'total_co2_kg', v_final_total,
    'total_co2_tons', ROUND((v_final_total / 1000.0)::numeric, 3),
    'co2_per_attendee_kg', v_co2_per_attendee,
    'is_green_certified', v_is_green,
    'attendee_count', v_attendee_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_event_footprint(UUID) TO authenticated, anon;
