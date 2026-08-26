ALTER TABLE public.events
ADD COLUMN max_attendees INTEGER;

ALTER TABLE public.events
ADD CONSTRAINT check_events_max_attendees
CHECK (
  max_attendees IS NULL OR max_attendees > 0
);