-- Cached translations are keyed by the current source hash, and removed when
-- an organizer changes an event description so stale copy can never be served.
CREATE TABLE IF NOT EXISTS public.content_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('event')),
  entity_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  language text NOT NULL CHECK (language ~ '^[a-z]{2,3}(-[a-z]{2})?$'),
  source_hash text NOT NULL,
  translated_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, language)
);

ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;
-- Direct client access intentionally has no RLS policy; translations are served
-- only through the authenticated, rate-limited edge function.

CREATE OR REPLACE FUNCTION public.invalidate_event_description_translations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    DELETE FROM public.content_translations
    WHERE entity_type = 'event' AND entity_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invalidate_event_description_translations ON public.events;
CREATE TRIGGER invalidate_event_description_translations
  AFTER UPDATE OF description ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_event_description_translations();
