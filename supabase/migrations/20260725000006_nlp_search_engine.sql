-- Migration: 20260725000004_nlp_search_engine.sql
-- Description: Implement NLP search engine using pg_trgm, ts_rewrite, and tsvector for events

-- 1. Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add search_vector to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
) STORED;

CREATE INDEX IF NOT EXISTS idx_events_search_vector ON public.events USING GIN (search_vector);

-- 3. Create synonym table for ts_rewrite
CREATE TABLE IF NOT EXISTS public.event_search_synonyms (
    id SERIAL PRIMARY KEY,
    target_query tsquery UNIQUE NOT NULL,
    substitute_query tsquery NOT NULL
);

-- Populate common college slang
INSERT INTO public.event_search_synonyms (target_query, substitute_query) VALUES 
(plainto_tsquery('english', 'comp sci'), plainto_tsquery('english', 'computer science')),
(plainto_tsquery('english', 'cs'), plainto_tsquery('english', 'computer science')),
(plainto_tsquery('english', 'intro'), plainto_tsquery('english', 'introduction')),
(plainto_tsquery('english', 'calc'), plainto_tsquery('english', 'calculus')),
(plainto_tsquery('english', 'stats'), plainto_tsquery('english', 'statistics')),
(plainto_tsquery('english', 'eng'), plainto_tsquery('english', 'engineering')),
(plainto_tsquery('english', 'psych'), plainto_tsquery('english', 'psychology')),
(plainto_tsquery('english', 'bio'), plainto_tsquery('english', 'biology')),
(plainto_tsquery('english', 'chem'), plainto_tsquery('english', 'chemistry')),
(plainto_tsquery('english', 'phys'), plainto_tsquery('english', 'physics')),
(plainto_tsquery('english', 'lit'), plainto_tsquery('english', 'literature')),
(plainto_tsquery('english', 'poli sci'), plainto_tsquery('english', 'political science')),
(plainto_tsquery('english', 'econ'), plainto_tsquery('english', 'economics')),
(plainto_tsquery('english', 'bba'), plainto_tsquery('english', 'business administration')),
(plainto_tsquery('english', 'mba'), plainto_tsquery('english', 'business administration')),
(plainto_tsquery('english', 'grad'), plainto_tsquery('english', 'graduate')),
(plainto_tsquery('english', 'undergrad'), plainto_tsquery('english', 'undergraduate')),
(plainto_tsquery('english', 'freshman'), plainto_tsquery('english', 'first year')),
(plainto_tsquery('english', 'sophomore'), plainto_tsquery('english', 'second year')),
(plainto_tsquery('english', 'junior'), plainto_tsquery('english', 'third year')),
(plainto_tsquery('english', 'senior'), plainto_tsquery('english', 'fourth year')),
(plainto_tsquery('english', 'alumni'), plainto_tsquery('english', 'alumnus')),
(plainto_tsquery('english', 'prof'), plainto_tsquery('english', 'professor')),
(plainto_tsquery('english', 'ta'), plainto_tsquery('english', 'teaching assistant'))
ON CONFLICT (target_query) DO NOTHING;

-- 4. Create materialized view for unique event words (lexemes) for typo correction
CREATE MATERIALIZED VIEW IF NOT EXISTS public.unique_event_words AS
SELECT word FROM ts_stat('SELECT search_vector FROM public.events');

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_event_words_word ON public.unique_event_words(word);
CREATE INDEX IF NOT EXISTS idx_unique_event_words_trgm ON public.unique_event_words USING GIN (word gin_trgm_ops);

-- 5. Create the advanced search function
CREATE OR REPLACE FUNCTION public.search_events_advanced(query_string TEXT)
RETURNS SETOF public.events
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    token TEXT;
    corrected_query_string TEXT := '';
    closest_word TEXT;
    final_tsquery tsquery;
BEGIN
    IF query_string IS NULL OR TRIM(query_string) = '' THEN
        RETURN QUERY SELECT * FROM public.events ORDER BY created_at DESC;
        RETURN;
    END IF;
    
    -- Basic tokenization by space for typo correction
    FOR token IN SELECT unnest(string_to_array(lower(trim(query_string)), ' ')) LOOP
        -- Remove non-alphanumeric chars for checking
        token := regexp_replace(token, '[^a-z0-9]', '', 'g');
        
        IF token = '' THEN
            CONTINUE;
        END IF;

        -- Check if token exists in unique_event_words or dictionary
        -- Since ts_stat provides lexemes, we need to compare the lexeme or just use similarity
        SELECT word INTO closest_word
        FROM public.unique_event_words
        WHERE word % token -- % is the similarity operator (trigram)
        ORDER BY similarity(word, token) DESC
        LIMIT 1;
        
        IF closest_word IS NOT NULL THEN
            corrected_query_string := corrected_query_string || ' ' || closest_word;
        ELSE
            -- Keep original if no close match
            corrected_query_string := corrected_query_string || ' ' || token;
        END IF;
    END LOOP;

    -- Convert to tsquery
    final_tsquery := plainto_tsquery('english', TRIM(corrected_query_string));

    -- If tsquery is empty (e.g., all stop words), fallback to original
    IF final_tsquery IS NULL OR final_tsquery::text = '' THEN
        final_tsquery := plainto_tsquery('english', query_string);
    END IF;

    -- Apply ts_rewrite for synonyms
    final_tsquery := ts_rewrite(
        final_tsquery, 
        'SELECT target_query, substitute_query FROM public.event_search_synonyms'
    );

    -- Execute search with ts_rank_cd + similarity for hybrid ranking
    RETURN QUERY 
    SELECT e.*
    FROM public.events e
    WHERE e.search_vector @@ final_tsquery
    ORDER BY 
        (ts_rank_cd(e.search_vector, final_tsquery) + 
         (similarity(e.title, query_string) * 0.5)) DESC;
         
END;
$$;

-- 6. Schedule unique_event_words materialized view refresh
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        BEGIN
            PERFORM cron.unschedule('refresh-unique-event-words');
        EXCEPTION WHEN OTHERS THEN
            -- Ignore
        END;
        
        -- Refresh nightly at 2 AM
        PERFORM cron.schedule('refresh-unique-event-words', '0 2 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY public.unique_event_words;');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Failed to schedule cron job for unique_event_words: %', SQLERRM;
END $$;
