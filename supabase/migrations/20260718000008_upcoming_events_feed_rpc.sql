-- Migration: Create DB Function to Retrieve Upcoming Events for Feed Timeline
-- Includes total RSVP counts and saved state for the caller.

CREATE OR REPLACE FUNCTION public.get_upcoming_events_feed(user_uuid UUID)
RETURNS TABLE (
  title TEXT,
  date TIMESTAMPTZ,
  location TEXT,
  rsvp_count BIGINT,
  is_bookmarked BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    e.title,
    e.start_date AS date,
    e.location,
    COALESCE((
      SELECT COUNT(*) 
      FROM public.event_rsvps r 
      WHERE r.event_id = e.id
    ), 0)::BIGINT AS rsvp_count,
    COALESCE(EXISTS(
      SELECT 1 
      FROM public.saved_events s 
      WHERE s.event_id = e.id AND s.user_id = user_uuid
    ), false) AS is_bookmarked
  FROM public.events e
  WHERE e.start_date >= NOW()
    AND e.status != 'canceled'
  ORDER BY e.start_date ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_upcoming_events_feed(UUID) TO authenticated;

-- Optimize query pattern with index on start date
CREATE INDEX IF NOT EXISTS idx_events_start_date ON public.events(start_date);
