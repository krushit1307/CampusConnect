CREATE OR REPLACE FUNCTION public.get_related_events(target_event_id UUID)
RETURNS TABLE (
  event_id UUID,
  match_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Collaborative filtering: Find all users who RSVP'd to target_event_id
  -- and find what other events those same users RSVP'd to.
  -- Rank those events by the frequency of common attendees.
  SELECT e.id AS event_id, COUNT(DISTINCT r2.user_id) AS match_count
  FROM public.event_rsvps r1
  JOIN public.event_rsvps r2 ON r1.user_id = r2.user_id
  JOIN public.events e ON r2.event_id = e.id
  WHERE r1.event_id = target_event_id
    AND r2.event_id != target_event_id
    AND r1.deleted_at IS NULL
    AND r2.deleted_at IS NULL
    AND e.deleted_at IS NULL
    AND e.status != 'canceled'
  GROUP BY e.id
  ORDER BY match_count DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.get_related_events(UUID) TO authenticated;
