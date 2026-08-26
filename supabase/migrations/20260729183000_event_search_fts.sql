-- Migration: Add fts_vector column, GIN index, and search_events RPC to events table

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS fts_vector tsvector;

-- Create trigger function to compute search vector
CREATE OR REPLACE FUNCTION public.events_fts_trigger_fn()
RETURNS trigger AS $$
BEGIN
  NEW.fts_vector := 
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger
DROP TRIGGER IF EXISTS trg_events_fts_vector ON public.events;
CREATE TRIGGER trg_events_fts_vector
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.events_fts_trigger_fn();

-- Backfill existing rows
UPDATE public.events 
SET fts_vector = 
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
WHERE fts_vector IS NULL;

CREATE INDEX IF NOT EXISTS idx_events_fts_vector 
ON public.events USING GIN (fts_vector);

CREATE OR REPLACE FUNCTION public.search_events(query_text TEXT)
RETURNS SETOF public.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  search_query tsquery;
BEGIN
  IF query_text IS NULL OR TRIM(query_text) = '' THEN
    RETURN QUERY SELECT * FROM public.events ORDER BY event_date ASC;
  ELSE
    search_query := websearch_to_tsquery('english', query_text);
    
    RETURN QUERY 
    SELECT *
    FROM public.events
    WHERE fts_vector @@ search_query
    ORDER BY ts_rank(fts_vector, search_query) DESC, event_date ASC;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_events(TEXT) TO authenticated, anon;
