-- Migration: 20260730172000_advanced_search_rpc.sql
-- Description: Advanced search API using Postgres ts_rank for relevance

-- 1. Update search_vector to use A for title and C for description
ALTER TABLE public.events DROP COLUMN IF EXISTS search_vector CASCADE;

ALTER TABLE public.events ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
) STORED;

-- 2. Ensure GIN index
CREATE INDEX IF NOT EXISTS idx_events_search_vector ON public.events USING GIN(search_vector);

-- 3. Update the search_events RPC
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
    RETURN QUERY SELECT * FROM public.events ORDER BY created_at DESC LIMIT 50;
  ELSE
    search_query := websearch_to_tsquery('english', query_text);
    
    RETURN QUERY 
    SELECT *
    FROM public.events
    WHERE search_vector @@ search_query
    ORDER BY ts_rank(search_vector, search_query) DESC, created_at DESC
    LIMIT 50;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_events(TEXT) TO authenticated, anon;
