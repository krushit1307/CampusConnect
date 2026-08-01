-- ============================================================
-- Migration: 20260801145000_club_analytics_custom_date_range.sql
-- Description: Adds timestamp-based custom date range support to club analytics RPC
-- Issue #1682: Sophisticated Date-Range Picker with custom presets
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_club_analytics(
  p_club_id UUID,
  p_range TEXT,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_authorized BOOLEAN;
  v_start_date DATE;
  v_end_date DATE := CURRENT_DATE;
  v_summary JSON;
  v_timeline JSON;
  v_top_events JSON;
  v_effective_start DATE;
  v_effective_end DATE;
BEGIN
  -- Authorization check: Club owner, admin member, or system admin
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
    RAISE EXCEPTION 'Not authorized to view analytics for this club';
  END IF;

  -- If explicit timestamps are provided, use them directly.
  IF p_start_at IS NOT NULL OR p_end_at IS NOT NULL THEN
    v_effective_start := COALESCE(p_start_at::DATE, p_end_at::DATE, CURRENT_DATE);
    v_effective_end := COALESCE(p_end_at::DATE, p_start_at::DATE, CURRENT_DATE);
    v_start_date := LEAST(v_effective_start, v_effective_end);
    v_end_date := GREATEST(v_effective_start, v_effective_end);
  ELSIF p_range = 'today' THEN
    v_start_date := v_end_date;
  ELSIF p_range = 'this-week' THEN
    v_start_date := DATE_TRUNC('week', v_end_date)::DATE;
  ELSIF p_range = 'this-semester' THEN
    v_start_date := CASE
      WHEN EXTRACT(MONTH FROM v_end_date) <= 6
      THEN MAKE_DATE(EXTRACT(YEAR FROM v_end_date)::INT, 1, 1)
      ELSE MAKE_DATE(EXTRACT(YEAR FROM v_end_date)::INT, 7, 1)
    END;
  ELSIF p_range = 'year-to-date' THEN
    v_start_date := DATE_TRUNC('year', v_end_date)::DATE;
  ELSIF p_range = '7d' THEN
    v_start_date := v_end_date - INTERVAL '6 days';
  ELSIF p_range = 'ytd' THEN
    v_start_date := DATE_TRUNC('year', v_end_date)::DATE;
  ELSE -- Default last 30 days
    v_start_date := v_end_date - INTERVAL '29 days';
  END IF;

  -- Build full date series timeline to prevent chart date gaps
  WITH date_series AS (
    SELECT generate_series(v_start_date, v_end_date, '1 day'::interval)::DATE AS date_val
  ),
  daily_rsvps AS (
    SELECT date_val, total_rsvps, total_checkins
    FROM public.v_club_daily_rsvps
    WHERE club_id = p_club_id AND date_val BETWEEN v_start_date AND v_end_date
  ),
  daily_discussions AS (
    SELECT date_val, total_posts, total_comments, total_activity
    FROM public.v_club_daily_discussions
    WHERE club_id = p_club_id AND date_val BETWEEN v_start_date AND v_end_date
  ),
  timeline_agg AS (
    SELECT
      ds.date_val::TEXT AS date,
      COALESCE(dr.total_rsvps, 0) AS rsvps,
      COALESCE(dr.total_checkins, 0) AS checkins,
      COALESCE(dd.total_posts, 0) AS posts,
      COALESCE(dd.total_comments, 0) AS comments,
      COALESCE(dd.total_activity, 0) AS activity
    FROM date_series ds
    LEFT JOIN daily_rsvps dr ON ds.date_val = dr.date_val
    LEFT JOIN daily_discussions dd ON ds.date_val = dd.date_val
    ORDER BY ds.date_val ASC
  )
  SELECT json_agg(t) INTO v_timeline FROM timeline_agg t;

  -- Build Summary KPI totals
  SELECT json_build_object(
    'total_rsvps', COALESCE(SUM(total_rsvps), 0),
    'total_checkins', COALESCE(SUM(total_checkins), 0),
    'total_posts', (
      SELECT COUNT(*) FROM public.posts
      WHERE club_id = p_club_id AND DATE(created_at) BETWEEN v_start_date AND v_end_date
    ),
    'total_comments', (
      SELECT COUNT(c.id) FROM public.comments c
      JOIN public.posts p ON p.id = c.post_id
      WHERE p.club_id = p_club_id AND DATE(c.created_at) BETWEEN v_start_date AND v_end_date
    ),
    'total_views', (
      SELECT COALESCE(SUM(views), 0) FROM public.events
      WHERE club_id = p_club_id
    ),
    'total_members', (
      SELECT COUNT(*) FROM public.club_members
      WHERE club_id = p_club_id AND status = 'approved'
    )
  ) INTO v_summary
  FROM public.v_club_daily_rsvps
  WHERE club_id = p_club_id AND date_val BETWEEN v_start_date AND v_end_date;

  -- Build Top Events list by page views & RSVPs
  WITH top_ev AS (
    SELECT
      e.id AS event_id,
      e.title AS event_title,
      COALESCE(e.views, 0) AS views,
      COUNT(r.id) AS rsvps,
      e.event_date::TEXT AS event_date
    FROM public.events e
    LEFT JOIN public.event_rsvps r ON e.id = r.event_id
    WHERE e.club_id = p_club_id
    GROUP BY e.id, e.title, e.views, e.event_date
    ORDER BY COALESCE(e.views, 0) DESC, COUNT(r.id) DESC
    LIMIT 5
  )
  SELECT json_agg(te) INTO v_top_events FROM top_ev te;

  -- Return final consolidated JSON payload
  RETURN json_build_object(
    'range', p_range,
    'start_date', v_start_date,
    'end_date', v_end_date,
    'summary', COALESCE(v_summary, json_build_object(
      'total_rsvps', 0, 'total_checkins', 0, 'total_posts', 0,
      'total_comments', 0, 'total_views', 0, 'total_members', 0
    )),
    'timeline', COALESCE(v_timeline, '[]'::json),
    'top_events', COALESCE(v_top_events, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_analytics(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
