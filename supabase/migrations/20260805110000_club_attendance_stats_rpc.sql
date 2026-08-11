-- =====================================================================
-- Migration: 20260805110000_club_attendance_stats_rpc.sql
-- Description: RPC computing a club's average & median event attendance
--              entirely in Postgres (Issue #2308).
--
-- Instead of fetching every event for a club into Node and running
-- `events.reduce((sum, e) => sum + e.rsvps, 0) / events.length`, the
-- database performs the aggregation with AVG() and PERCENTILE_CONT() and
-- returns a single pre-computed JSON payload.
--
-- Note on type casting: AVG()/PERCENTILE_CONT() return NUMERIC/double
-- precision values. json_build_object() serializes them as JSON numbers,
-- so the frontend always receives numbers (never pg-driver strings).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_club_attendance_stats(p_club_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_authorized BOOLEAN;
  v_event_count BIGINT;
  v_average NUMERIC(10,2);
  v_median NUMERIC(10,2);
BEGIN
  -- Authorization check: club owner, admin member, or system admin
  SELECT EXISTS (
    SELECT 1 FROM public.clubs WHERE id = p_club_id AND created_by = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'owner')
      AND status = 'approved'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'system_admin'
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Not authorized to view attendance stats for this club';
  END IF;

  -- Aggregate RSVP counts per event, then compute average & median in SQL.
  -- Left join keeps events with zero RSVPs in the calculation.
  WITH per_event AS (
    SELECT
      e.id,
      COUNT(r.id)::BIGINT AS rsvp_count
    FROM public.events e
    LEFT JOIN public.event_rsvps r ON r.event_id = e.id
    WHERE e.club_id = p_club_id
    GROUP BY e.id
  )
  SELECT
    COUNT(*)::BIGINT,
    COALESCE(AVG(rsvp_count), 0)::NUMERIC(10,2),
    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rsvp_count), 0)::NUMERIC(10,2)
  INTO v_event_count, v_average, v_median
  FROM per_event;

  RETURN json_build_object(
    'club_id', p_club_id,
    'event_count', v_event_count,
    'average', v_average,
    'median', v_median
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_attendance_stats(UUID) TO authenticated;
