-- ============================================================
-- Migration: 20260726010000_get_user_attendance_rate.sql
-- Issue: #1180
-- Description:
--   Creates the public.get_user_attendance_rate(target_user_id)
--   function to calculate the user attendance rate (percentage of
--   ended event RSVPs where checked_in = true).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_attendance_rate(target_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_past_rsvps INTEGER;
  checked_in_count INTEGER;
BEGIN
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE r.checked_in = TRUE)::INTEGER
  INTO
    total_past_rsvps,
    checked_in_count
  FROM public.event_rsvps r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.user_id = target_user_id
    AND COALESCE(e.end_date, e.start_date, e.event_date) < NOW();

  IF total_past_rsvps = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((checked_in_count * 100.0) / total_past_rsvps)::INTEGER;
END;
$$;

-- Security hardening & permissions
REVOKE ALL ON FUNCTION public.get_user_attendance_rate(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_attendance_rate(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_user_attendance_rate(UUID) IS
  'Calculates the ratio of checked-in RSVPs to total past event RSVPs for a given user as an integer percentage.';
