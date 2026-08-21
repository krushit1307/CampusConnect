-- Migration: Add prerequisite_event_id to events

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS prerequisite_event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_prerequisite 
ON public.events(prerequisite_event_id);
