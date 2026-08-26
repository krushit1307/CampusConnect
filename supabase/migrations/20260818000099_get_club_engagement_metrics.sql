-- Migration: 20260818000000_get_club_engagement_metrics.sql
-- Description: RPC to fetch conversion funnel and time-series RSVP metrics for a club.

CREATE OR REPLACE FUNCTION public.get_club_engagement_metrics(p_club_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_views BIGINT;
  v_total_rsvps BIGINT;
  v_total_checked_in BIGINT;
  v_rsvps_by_date JSONB;
  v_funnel JSONB;
  v_curr_sem_rsvps BIGINT;
  v_prev_sem_rsvps BIGINT;
  v_sem_growth_pct NUMERIC;
BEGIN
  -- 1. Calculate Funnel metrics
  SELECT COALESCE(SUM(em.views), 0) INTO v_total_views
  FROM public.events e
  LEFT JOIN public.event_metrics em ON em.event_id = e.id
  WHERE e.club_id = p_club_id AND e.deleted_at IS NULL;

  SELECT COALESCE(COUNT(r.id), 0) INTO v_total_rsvps
  FROM public.events e
  JOIN public.event_rsvps r ON r.event_id = e.id
  WHERE e.club_id = p_club_id AND e.deleted_at IS NULL;

  SELECT COALESCE(COUNT(r.id), 0) INTO v_total_checked_in
  FROM public.events e
  JOIN public.event_rsvps r ON r.event_id = e.id
  WHERE e.club_id = p_club_id AND e.deleted_at IS NULL AND (r.checked_in = TRUE OR r.status = 'approved');

  -- 2. Construct funnel JSON
  v_funnel := jsonb_build_array(
    jsonb_build_object('name', 'Page Views', 'value', v_total_views),
    jsonb_build_object('name', 'RSVPs', 'value', v_total_rsvps),
    jsonb_build_object('name', 'Checked-In', 'value', v_total_checked_in)
  );

  -- 3. Calculate RSVP trends (daily for the last 90 days)
  SELECT COALESCE(jsonb_agg(d), '[]'::jsonb) INTO v_rsvps_by_date
  FROM (
    SELECT TO_CHAR(r.rsvp_at::date, 'YYYY-MM-DD') AS date, COUNT(r.id) AS count
    FROM public.events e
    JOIN public.event_rsvps r ON r.event_id = e.id
    WHERE e.club_id = p_club_id AND e.deleted_at IS NULL AND r.rsvp_at >= NOW() - INTERVAL '90 days'
    GROUP BY r.rsvp_at::date
    ORDER BY r.rsvp_at::date ASC
  ) d;

  -- 4. Calculate Semester-over-Semester RSVPs comparison
  SELECT COALESCE(COUNT(r.id), 0) INTO v_curr_sem_rsvps
  FROM public.events e
  JOIN public.event_rsvps r ON r.event_id = e.id
  WHERE e.club_id = p_club_id AND e.deleted_at IS NULL AND r.rsvp_at >= NOW() - INTERVAL '180 days';

  SELECT COALESCE(COUNT(r.id), 0) INTO v_prev_sem_rsvps
  FROM public.events e
  JOIN public.event_rsvps r ON r.event_id = e.id
  WHERE e.club_id = p_club_id AND e.deleted_at IS NULL 
    AND r.rsvp_at >= NOW() - INTERVAL '360 days' 
    AND r.rsvp_at < NOW() - INTERVAL '180 days';

  IF v_prev_sem_rsvps > 0 THEN
    v_sem_growth_pct := ROUND(((v_curr_sem_rsvps::NUMERIC - v_prev_sem_rsvps::NUMERIC) / v_prev_sem_rsvps::NUMERIC) * 100, 2);
  ELSE
    v_sem_growth_pct := 0.00;
  END IF;

  RETURN jsonb_build_object(
    'funnel', v_funnel,
    'rsvps_by_date', v_rsvps_by_date,
    'total_views', v_total_views,
    'total_rsvps', v_total_rsvps,
    'total_checked_in', v_total_checked_in,
    'current_semester_rsvps', v_curr_sem_rsvps,
    'previous_semester_rsvps', v_prev_sem_rsvps,
    'semester_growth_pct', v_sem_growth_pct
  );
END;
$$;

-- Restrict execution
REVOKE EXECUTE ON FUNCTION public.get_club_engagement_metrics(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_club_engagement_metrics(UUID) TO authenticated;
