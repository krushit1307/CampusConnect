-- Migration: Add fts_vector column, GIN index, and search_events RPC to events table

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS fts_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
) STORED;

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
