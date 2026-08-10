-- Migration: 20260804103000_ts_rank_cd_search_relevance.sql
-- Description: Optimize full-text search with ts_rank_cd cover density ranking & setweight prioritization (#2319).

-- Update search_clubs RPC to use ts_rank_cd with weighted tsvector (Name = Weight 'A', Description = Weight 'B')
CREATE OR REPLACE FUNCTION public.search_clubs(search_term TEXT)
RETURNS SETOF public.clubs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    expanded_term TEXT;
    ts_q tsquery;
BEGIN
    IF search_term IS NULL OR TRIM(search_term) = '' THEN
        RETURN QUERY SELECT * FROM public.clubs ORDER BY name ASC;
        RETURN;
    END IF;

    -- Expand synonyms (e.g. "cs" -> "computer science")
    expanded_term := public.expand_campus_synonyms(search_term);
    ts_q := plainto_tsquery('english', expanded_term);

    -- Set pg_trgm similarity threshold
    PERFORM set_config('pg_trgm.similarity_threshold', '0.2', true);

    RETURN QUERY
    SELECT c.*
    FROM public.clubs c
    WHERE 
        -- Weighted full-text search match against name (Weight A) + description (Weight B)
        (
          setweight(to_tsvector('english', coalesce(c.name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(c.description, '')), 'B')
        ) @@ ts_q
        -- Trigram similarity against original query or expanded term
        OR c.name % search_term 
        OR c.description % search_term
        OR c.name % expanded_term
        OR c.description % expanded_term
        -- Substring fallback
        OR c.name ILIKE '%' || search_term || '%'
        OR c.name ILIKE '%' || expanded_term || '%'
        OR c.description ILIKE '%' || search_term || '%'
        OR c.description ILIKE '%' || expanded_term || '%'
    ORDER BY 
        (
            CASE WHEN c.name ILIKE search_term || '%' THEN 100 ELSE 0 END +
            CASE WHEN c.name ILIKE '%' || expanded_term || '%' THEN 80 ELSE 0 END +
            (similarity(c.name, search_term) * 50) +
            (ts_rank_cd(
              setweight(to_tsvector('english', coalesce(c.name, '')), 'A') ||
              setweight(to_tsvector('english', coalesce(c.description, '')), 'B'),
              ts_q
            ) * 30)
        ) DESC,
        c.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_clubs(TEXT) TO authenticated, anon;
