-- Add automatically detected content warnings to events.
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS content_warnings TEXT[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_events_content_warnings
ON public.events
USING GIN (content_warnings);
