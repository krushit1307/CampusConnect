-- Migration: 20260722040000_search_events_optimization.sql
-- Description: Implement search query optimizer for events (Issue #306 part 2)

-- Ensure pg_trgm extension is enabled (likely already enabled by the clubs search optimization, but safe to repeat)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram indexes for fast case-insensitive search on events
CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON public.events USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_events_description_trgm ON public.events USING gin (description gin_trgm_ops);

-- Create the optimized search function for events
CREATE OR REPLACE FUNCTION public.search_events(query_text TEXT)
RETURNS SETOF public.events
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF query_text IS NULL OR TRIM(query_text) = '' THEN
        RETURN QUERY SELECT * FROM public.events;
    ELSE
        RETURN QUERY 
        SELECT *
        FROM public.events
        WHERE title ILIKE '%' || query_text || '%'
           OR description ILIKE '%' || query_text || '%'
        ORDER BY similarity(title, query_text) DESC;
    END IF;
END;
$$;
