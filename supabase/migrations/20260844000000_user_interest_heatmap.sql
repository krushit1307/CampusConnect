-- Migration: 20260844000000_user_interest_heatmap.sql
-- Description: Dynamic User Interest Heatmap from attended event tags with privacy controls (#3546)

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hide_attendance_analytics BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.hide_attendance_analytics IS 'Privacy toggle to hide attendance interest heatmap from public profiles';

-- RPC: Get user interest heatmap based strictly on attended events
CREATE OR REPLACE FUNCTION public.get_user_interest_heatmap(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_hidden BOOLEAN;
  v_total_tag_count INT;
  v_result JSONB;
BEGIN
  -- Check user privacy preference
  SELECT hide_attendance_analytics INTO v_is_hidden
  FROM public.profiles
  WHERE id = p_user_id;

  -- If privacy mode is enabled and viewer is not the profile owner, return hidden response
  IF v_is_hidden IS TRUE AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
    RETURN jsonb_build_object(
      'is_private', true,
      'total_attended_events', 0,
      'distribution', '[]'::jsonb
    );
  END IF;

  -- Aggregate tags from all attended events
  WITH user_attended_tags AS (
    SELECT unnest(e.tags) AS tag_name
    FROM public.event_rsvps r
    JOIN public.events e ON r.event_id = e.id
    WHERE r.user_id = p_user_id
      AND LOWER(r.status) = 'attended'
      AND e.tags IS NOT NULL
  ),
  tag_counts AS (
    SELECT 
      tag_name,
      COUNT(*) AS occurrence_count
    FROM user_attended_tags
    GROUP BY tag_name
  ),
  total_count AS (
    SELECT COALESCE(SUM(occurrence_count), 0) AS total FROM tag_counts
  )
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'tag', tc.tag_name,
          'count', tc.occurrence_count,
          'percentage', ROUND((tc.occurrence_count::numeric / NULLIF(tot.total, 0)) * 100, 1)
        )
        ORDER BY tc.occurrence_count DESC
      ),
      '[]'::jsonb
    )
  INTO v_result
  FROM tag_counts tc, total_count tot;

  RETURN jsonb_build_object(
    'is_private', COALESCE(v_is_hidden, false),
    'total_attended_events', (
      SELECT COUNT(*) FROM public.event_rsvps 
      WHERE user_id = p_user_id AND LOWER(status) = 'attended'
    ),
    'distribution', v_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_interest_heatmap(UUID) TO authenticated, anon;
