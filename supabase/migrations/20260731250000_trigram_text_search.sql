-- Migration: 20260731250000_trigram_text_search.sql
-- Description: Enable pg_trgm trigram extension, create GIN search indexes on clubs name and description, and add search_clubs similarity search RPC.

-- 1. Enablepg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create GIN indexes for fast trigram prefix matching and typo tolerance
CREATE INDEX IF NOT EXISTS clubs_name_trgm_idx ON public.clubs USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS clubs_description_trgm_idx ON public.clubs USING gin (description gin_trgm_ops);

-- 3. Create the RPC search function
CREATE OR REPLACE FUNCTION public.search_clubs(search_term TEXT)
RETURNS SETOF public.clubs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set pg_trgm.similarity_threshold to 0.3 as requested
  PERFORM set_config('pg_trgm.similarity_threshold', '0.3', true);
  
  RETURN QUERY
    SELECT *
    FROM public.clubs
    WHERE name % search_term OR description % search_term
    ORDER BY similarity(name, search_term) DESC;
END;
$$;
