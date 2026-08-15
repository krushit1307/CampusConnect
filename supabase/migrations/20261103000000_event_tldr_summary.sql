-- Automated Event Description Summarizer (#3240)
-- Summaries are advisory feed copy. Organizers can always replace them.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS tldr_summary TEXT,
  ADD COLUMN IF NOT EXISTS tldr_summary_source TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS tldr_summary_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tldr_summary_error TEXT;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_tldr_summary_length;

ALTER TABLE public.events
  ADD CONSTRAINT events_tldr_summary_length
  CHECK (tldr_summary IS NULL OR char_length(tldr_summary) <= 100);

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_tldr_summary_source;

ALTER TABLE public.events
  ADD CONSTRAINT events_tldr_summary_source
  CHECK (tldr_summary_source IN ('none', 'ai', 'organizer', 'fallback'));

CREATE OR REPLACE FUNCTION public.handle_event_tldr_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  function_url TEXT;
  webhook_secret TEXT;
BEGIN
  IF NEW.description IS NULL OR btrim(NEW.description) = '' THEN
    RETURN NEW;
  END IF;

  function_url := current_setting('app.settings.edge_function_url', true) || '/summarize-event-description';
  webhook_secret := current_setting('app.settings.event_summarizer_webhook_secret', true);

  IF function_url IS NULL OR function_url = '/summarize-event-description' THEN
    RAISE WARNING 'Event summarizer URL is not configured; feed fallback will be used.';
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'http_post' AND n.nspname = 'net'
  ) THEN
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', COALESCE(webhook_secret, '')),
      body := jsonb_build_object('event_id', NEW.id, 'description', NEW.description)
    );
  ELSIF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'http_post' AND n.nspname = 'extensions'
  ) THEN
    PERFORM extensions.http_post(
      url := function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', COALESCE(webhook_secret, '')),
      body := jsonb_build_object('event_id', NEW.id, 'description', NEW.description)
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Event summarizer webhook failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_event_created_tldr_summary ON public.events;
CREATE TRIGGER on_event_created_tldr_summary
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.handle_event_tldr_summary();

COMMENT ON COLUMN public.events.tldr_summary IS 'Organizer-editable single-sentence feed summary, limited to 100 characters.';
COMMENT ON FUNCTION public.handle_event_tldr_summary() IS 'Queues asynchronous TL;DR generation after an event is inserted; event creation never depends on the LLM.';
