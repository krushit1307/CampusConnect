-- Migration: Add get_yearly_summary PL/pgSQL function
-- Description: Aggregates yearly stats for a user's campus involvement into a JSON payload.

CREATE OR REPLACE FUNCTION public.get_yearly_summary(user_id UUID, target_year INT)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_events_attended INT;
  v_most_visited_club TEXT;
  v_total_comments_posted INT;
  v_busiest_month TEXT;
BEGIN
  -- 1. Total events attended (checked in)
  SELECT COALESCE(COUNT(*), 0)::INT
  INTO v_total_events_attended
  FROM public.event_rsvps r
  WHERE r.user_id = get_yearly_summary.user_id
    AND r.checked_in = TRUE
    AND EXTRACT(YEAR FROM r.rsvp_at) = get_yearly_summary.target_year;

  -- 2. Most visited club (name of the club with most checked-in events)
  SELECT c.name
  INTO v_most_visited_club
  FROM public.event_rsvps r
  JOIN public.events e ON r.event_id = e.id
  JOIN public.clubs c ON e.club_id = c.id
  WHERE r.user_id = get_yearly_summary.user_id
    AND r.checked_in = TRUE
    AND EXTRACT(YEAR FROM r.rsvp_at) = get_yearly_summary.target_year
  GROUP BY c.id, c.name
  ORDER BY COUNT(*) DESC, c.name ASC
  LIMIT 1;

  -- 3. Total comments posted
  SELECT COALESCE(COUNT(*), 0)::INT
  INTO v_total_comments_posted
  FROM public.comments c
  WHERE c.author_id = get_yearly_summary.user_id
    AND EXTRACT(YEAR FROM c.created_at) = get_yearly_summary.target_year;

  -- 4. Busiest month (based on checked-in events and comments)
  SELECT TO_CHAR(activity_date, 'FMMonth')
  INTO v_busiest_month
  FROM (
    SELECT r.rsvp_at AS activity_date
    FROM public.event_rsvps r
    WHERE r.user_id = get_yearly_summary.user_id
      AND r.checked_in = TRUE
      AND EXTRACT(YEAR FROM r.rsvp_at) = get_yearly_summary.target_year
    UNION ALL
    SELECT c.created_at AS activity_date
    FROM public.comments c
    WHERE c.author_id = get_yearly_summary.user_id
      AND EXTRACT(YEAR FROM c.created_at) = get_yearly_summary.target_year
  ) sub
  GROUP BY EXTRACT(MONTH FROM activity_date), TO_CHAR(activity_date, 'FMMonth')
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Return aggregated JSON payload
  RETURN json_build_object(
    'total_events_attended', v_total_events_attended,
    'most_visited_club', v_most_visited_club,
    'total_comments_posted', v_total_comments_posted,
    'busiest_month', v_busiest_month
  );
END;
$$;

-- Grant execution privileges to authenticated users and service_role
REVOKE ALL ON FUNCTION public.get_yearly_summary(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_yearly_summary(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_yearly_summary(UUID, INT) TO service_role;
