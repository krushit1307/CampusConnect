-- ============================================================
-- Migration: 20260730100000_club_analytics_dashboard_views.sql
-- Description: Creates Postgres SQL Views & RPC for Club Analytics Dashboard
-- Issue #1442: Advanced Analytics Dashboard using Recharts & Supabase Views
-- ============================================================

-- 1. View: Daily RSVPs per club
CREATE OR REPLACE VIEW public.v_club_daily_rsvps AS
SELECT
  e.club_id,
  DATE(r.rsvp_at) AS date_val,
  COUNT(r.id) AS total_rsvps,
  COUNT(CASE WHEN r.checked_in THEN 1 END) AS total_checkins
FROM public.event_rsvps r
JOIN public.events e ON e.id = r.event_id
GROUP BY e.club_id, DATE(r.rsvp_at);

-- 2. View: Daily discussions (posts & comments) per club
CREATE OR REPLACE VIEW public.v_club_daily_discussions AS
WITH daily_posts AS (
  SELECT
    club_id,
    DATE(created_at) AS date_val,
    COUNT(*) AS post_count
  FROM public.posts
  GROUP BY club_id, DATE(created_at)
),
daily_comments AS (
  SELECT
    p.club_id,
    DATE(c.created_at) AS date_val,
    COUNT(c.id) AS comment_count
  FROM public.comments c
  JOIN public.posts p ON p.id = c.post_id
  GROUP BY p.club_id, DATE(c.created_at)
)
SELECT
  COALESCE(dp.club_id, dc.club_id) AS club_id,
  COALESCE(dp.date_val, dc.date_val) AS date_val,
  COALESCE(dp.post_count, 0) AS total_posts,
  COALESCE(dc.comment_count, 0) AS total_comments,
  (COALESCE(dp.post_count, 0) + COALESCE(dc.comment_count, 0)) AS total_activity
FROM daily_posts dp
FULL OUTER JOIN daily_comments dc
  ON dp.club_id = dc.club_id AND dp.date_val = dc.date_val;

-- 3. View: Event page views per club
CREATE OR REPLACE VIEW public.v_club_event_views AS
SELECT
  e.club_id,
  e.id AS event_id,
  e.title AS event_title,
  COALESCE(e.views, 0) AS page_views,
  DATE(e.created_at) AS event_created_date,
  DATE(e.event_date) AS event_date
FROM public.events e;

-- 4. RPC Function: Get complete club analytics payload
CREATE OR REPLACE FUNCTION get_club_analytics(
  p_club_id UUID,
  p_range TEXT DEFAULT '30d'
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

  -- Determine start date based on range filter ('7d', '30d', 'ytd')
  IF p_range = '7d' THEN
    v_start_date := v_end_date - INTERVAL '6 days';
  ELSIF p_range = 'ytd' THEN
    v_start_date := DATE_TRUNC('year', v_end_date)::DATE;
  ELSE -- Default '30d'
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

-- Grant permissions
GRANT SELECT ON public.v_club_daily_rsvps TO authenticated;
GRANT SELECT ON public.v_club_daily_discussions TO authenticated;
GRANT SELECT ON public.v_club_event_views TO authenticated;
GRANT EXECUTE ON FUNCTION get_club_analytics(UUID, TEXT) TO authenticated;
