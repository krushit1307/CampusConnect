-- Migration: drop_legacy_ilike_search.sql
-- Description: Remove the old ILIKE-based search_events function and its
-- trigram indexes now that all callers use the GIN/tsvector-based
-- search_events_advanced function (see 20260725000004_nlp_search_engine.sql).

DROP FUNCTION IF EXISTS public.search_events(TEXT);
DROP INDEX IF EXISTS public.idx_events_title_trgm;
DROP INDEX IF EXISTS public.idx_events_description_trgm;