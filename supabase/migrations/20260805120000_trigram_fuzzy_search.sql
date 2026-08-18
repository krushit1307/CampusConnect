-- Migration: pg_trgm Trigram Fuzzy Search
-- Timestamp: 20260805120000

-- 1. Enable the pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create GiST index on name for fast trigram search queries
CREATE INDEX IF NOT EXISTS clubs_trgm_idx ON public.clubs USING GIST (name gist_trgm_ops);

-- 3. Refactor search_clubs to implement pg_trgm similarity search with short string guards
CREATE OR REPLACE FUNCTION public.search_clubs(search_term TEXT)
RETURNS SETOF public.clubs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    expanded_term TEXT;
    ts_q tsquery;
    cleaned_term TEXT;
    term_length INT;
BEGIN
    IF search_term IS NULL OR TRIM(search_term) = '' THEN
        RETURN QUERY SELECT * FROM public.clubs ORDER BY name ASC;
        RETURN;
    END IF;

    cleaned_term := TRIM(search_term);
    term_length := char_length(cleaned_term);

    -- Expand synonyms (e.g. "cs" -> "computer science")
    expanded_term := public.expand_campus_synonyms(cleaned_term);
    ts_q := plainto_tsquery('english', expanded_term);

    -- Configure similarity threshold to 0.3
    PERFORM set_config('pg_trgm.similarity_threshold', '0.3', true);

    IF term_length <= 3 THEN
        -- Short string search: combine exact match, ILIKE prefix/substring checks,
        -- and full text search if valid. Bypass trigram `%` operator to avoid false positives.
        RETURN QUERY
        SELECT c.*
        FROM public.clubs c
        WHERE c.name ILIKE '%' || cleaned_term || '%'
           OR c.description ILIKE '%' || cleaned_term || '%'
           OR c.name ILIKE '%' || expanded_term || '%'
           OR c.description ILIKE '%' || expanded_term || '%'
           OR (
              ts_q IS NOT NULL AND
              (
                setweight(to_tsvector('english', coalesce(c.name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(c.description, '')), 'B')
              ) @@ ts_q
           )
        ORDER BY 
            CASE 
                WHEN LOWER(c.name) = LOWER(cleaned_term) THEN 1
                WHEN LOWER(c.name) = LOWER(expanded_term) THEN 2
                WHEN c.name ILIKE cleaned_term || '%' THEN 3
                ELSE 4
            END ASC,
            c.name ASC;
    ELSE
        -- Normal/long string fuzzy search utilizing GIST trigram operator
        RETURN QUERY
        SELECT c.*
        FROM public.clubs c
        WHERE c.name % cleaned_term
           OR c.name % expanded_term
           OR c.name ILIKE '%' || cleaned_term || '%'
           OR c.name ILIKE '%' || expanded_term || '%'
           OR c.description ILIKE '%' || cleaned_term || '%'
           OR c.description ILIKE '%' || expanded_term || '%'
           OR (
              ts_q IS NOT NULL AND
              (
                setweight(to_tsvector('english', coalesce(c.name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(c.description, '')), 'B')
              ) @@ ts_q
           )
        ORDER BY
            CASE 
                WHEN LOWER(c.name) = LOWER(cleaned_term) THEN 0
                WHEN LOWER(c.name) = LOWER(expanded_term) THEN 1
                ELSE 2
            END ASC,
            -- High weight to name similarity
            (similarity(c.name, cleaned_term) * 70) +
            -- Weighted contribution of full-text search cover density if matches
            (
                CASE 
                    WHEN ts_q IS NOT NULL AND 
                         (setweight(to_tsvector('english', coalesce(c.name, '')), 'A') || 
                          setweight(to_tsvector('english', coalesce(c.description, '')), 'B')) @@ ts_q
                    THEN ts_rank_cd(
                        setweight(to_tsvector('english', coalesce(c.name, '')), 'A') ||
                        setweight(to_tsvector('english', coalesce(c.description, '')), 'B'),
                        ts_q
                    ) * 30
                    ELSE 0
                END
            ) DESC,
            c.name ASC;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_clubs(TEXT) TO authenticated, anon;
