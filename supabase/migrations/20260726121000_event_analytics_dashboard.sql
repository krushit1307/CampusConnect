-- ============================================================
-- Migration: 20260726121000_event_analytics_dashboard.sql
-- Description:
-- Adds major and grad_year to profiles.
-- Creates an RPC function to fetch event analytics.
-- ============================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS major TEXT,
ADD COLUMN IF NOT EXISTS grad_year INTEGER;

-- Create function to get event analytics
CREATE OR REPLACE FUNCTION get_event_analytics(p_event_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_club_id UUID;
  v_is_authorized BOOLEAN;
  v_rsvps_by_date JSON;
  v_attendees_by_major JSON;
  v_attendees_by_year JSON;
BEGIN
  -- 1. Get the club ID for the event
  SELECT club_id INTO v_club_id
  FROM events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- 2. Check authorization: User must be club creator or an approved admin member
  SELECT EXISTS (
    SELECT 1 FROM clubs WHERE id = v_club_id AND created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM club_members 
    WHERE club_id = v_club_id 
      AND user_id = auth.uid() 
      AND role = 'admin' 
      AND status = 'approved'
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Not authorized to view analytics for this event';
  END IF;

  -- 3. RSVPs over time (last 30 days)
  WITH date_series AS (
    SELECT (CURRENT_DATE - i)::DATE AS date_val
    FROM generate_series(0, 29) i
  ),
  daily_rsvps AS (
    SELECT 
      DATE(rsvp_at) AS rsvp_date,
      COUNT(*) AS total_rsvps
    FROM event_rsvps
    WHERE event_id = p_event_id
      AND rsvp_at >= (CURRENT_DATE - 29)
    GROUP BY DATE(rsvp_at)
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'date', d.date_val,
        'count', COALESCE(dr.total_rsvps, 0)
      ) ORDER BY d.date_val ASC
    ), 
    '[]'::json
  ) INTO v_rsvps_by_date
  FROM date_series d
  LEFT JOIN daily_rsvps dr ON d.date_val = dr.rsvp_date;

  -- 4. Attendees by major
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'name', COALESCE(agg.major, 'Undeclared/Unknown'),
        'value', agg.count
      )
    ),
    '[]'::json
  ) INTO v_attendees_by_major
  FROM (
    SELECT p.major, COUNT(*) as count
    FROM event_rsvps er
    JOIN profiles p ON er.user_id = p.id
    WHERE er.event_id = p_event_id
    GROUP BY p.major
  ) agg;

  -- 5. Attendees by year
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'name', COALESCE(agg.grad_year::TEXT, 'Unknown'),
        'value', agg.count
      )
    ),
    '[]'::json
  ) INTO v_attendees_by_year
  FROM (
    SELECT p.grad_year, COUNT(*) as count
    FROM event_rsvps er
    JOIN profiles p ON er.user_id = p.id
    WHERE er.event_id = p_event_id
    GROUP BY p.grad_year
  ) agg;

  -- Return final JSON
  RETURN json_build_object(
    'rsvps_by_date', v_rsvps_by_date,
    'attendees_by_major', v_attendees_by_major,
    'attendees_by_year', v_attendees_by_year
  );

END;
$$;
