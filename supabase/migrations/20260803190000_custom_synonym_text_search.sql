-- Migration: 20260803190000_custom_synonym_text_search.sql
-- Description: Custom Postgres text search dictionary with campus synonyms for Clubs and Events search (#2149).

-- 1. Create synonym table for dynamic campus dictionary expansion
CREATE TABLE IF NOT EXISTS public.campus_synonyms (
    term TEXT PRIMARY KEY,
    synonym TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on campus_synonyms
ALTER TABLE public.campus_synonyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to campus_synonyms"
    ON public.campus_synonyms FOR SELECT
    USING (true);

-- Populate common campus synonyms & abbreviations
INSERT INTO public.campus_synonyms (term, synonym) VALUES
    ('cs', 'computer science'),
    ('comp sci', 'computer science'),
    ('swe', 'software engineering'),
    ('eecs', 'electrical engineering'),
    ('bba', 'business administration'),
    ('mba', 'business administration'),
    ('psych', 'psychology'),
    ('bio', 'biology'),
    ('chem', 'chemistry'),
    ('phys', 'physics'),
    ('calc', 'calculus'),
    ('stats', 'statistics'),
    ('eng', 'engineering'),
    ('lit', 'literature'),
    ('poli sci', 'political science'),
    ('econ', 'economics')
ON CONFLICT (term) DO UPDATE SET synonym = EXCLUDED.synonym;

-- 2. Create PL/pgSQL function to expand synonyms in a search query string
CREATE OR REPLACE FUNCTION public.expand_campus_synonyms(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cleaned_input TEXT;
    syn_record RECORD;
    result_text TEXT;
BEGIN
    IF input_text IS NULL OR TRIM(input_text) = '' THEN
        RETURN input_text;
    END IF;

    cleaned_input := LOWER(TRIM(input_text));
    result_text := cleaned_input;

    -- Replace multi-word terms first, then single-word terms
    FOR syn_record IN SELECT term, synonym FROM public.campus_synonyms ORDER BY length(term) DESC LOOP
        IF result_text ~* ('\y' || syn_record.term || '\y') THEN
            result_text := regexp_replace(result_text, '\y' || syn_record.term || '\y', syn_record.synonym, 'gi');
        END IF;
    END LOOP;

    RETURN result_text;
END;
$$;

-- 3. Update search_clubs RPC function to utilize synonym expansion and full-text + trigram search
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
        -- Full-text search match against name + description using expanded synonyms
        (to_tsvector('english', coalesce(c.name, '') || ' ' || coalesce(c.description, '')) @@ ts_q)
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
            (ts_rank(to_tsvector('english', coalesce(c.name, '') || ' ' || coalesce(c.description, '')), ts_q) * 20)
        ) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_clubs(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.expand_campus_synonyms(TEXT) TO authenticated, anon;
