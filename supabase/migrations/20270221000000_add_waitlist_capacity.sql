-- Migration: Add waitlist_capacity to events and waitlist_count helper function
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS waitlist_capacity INTEGER DEFAULT 50;

CREATE OR REPLACE FUNCTION public.waitlist_count(event_row public.events)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM public.event_waitlist
    WHERE event_id = event_row.id
  );
END;
$$ LANGUAGE plpgsql STABLE;
