CREATE OR REPLACE FUNCTION get_trending_tags()
RETURNS TABLE(id UUID, name TEXT, velocity TEXT) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH current_week AS (
    SELECT standard_tag_id, COUNT(*) as rsvp_count
    FROM event_rsvps
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY standard_tag_id
  ),
  previous_week AS (
    SELECT standard_tag_id, COUNT(*) as rsvp_count
    FROM event_rsvps
    WHERE created_at >= NOW() - INTERVAL '14 days' 
      AND created_at < NOW() - INTERVAL '7 days'
    GROUP BY standard_tag_id
  )
  SELECT 
    t.id, 
    t.name, 
    -- Calculate percentage increase and format as +X%
    '+' || ROUND(
      CASE 
        WHEN COALESCE(pw.rsvp_count, 0) = 0 THEN 100.0 -- Prevent division by zero
        ELSE ((cw.rsvp_count - pw.rsvp_count)::numeric / pw.rsvp_count) * 100 
      END
    )::TEXT || '%' AS velocity
  FROM standard_tags t
  JOIN current_week cw ON t.id = cw.standard_tag_id
  LEFT JOIN previous_week pw ON t.id = pw.standard_tag_id
  ORDER BY cw.rsvp_count DESC
  LIMIT 5;
END;
$$;
