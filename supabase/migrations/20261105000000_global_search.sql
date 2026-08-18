-- Migration: global_search RPC
-- Timestamp: 20261105000000
--
-- Unified full-text search across events, clubs, and profiles for the
-- global Cmd+K command palette. Returns a mixed JSON array of results
-- categorized by entity type so the frontend can group them.

-- 1. Ensure required extensions exist (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Global search RPC
CREATE OR REPLACE FUNCTION public.global_search(p_query TEXT DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cleaned_query TEXT;
    ts_q tsquery;
    result JSON;
BEGIN
    IF p_query IS NULL OR TRIM(p_query) = '' THEN
        RETURN '[]'::JSON;
    END IF;

    cleaned_query := TRIM(p_query);
    ts_q := websearch_to_tsquery('english', cleaned_query);

    IF ts_q IS NULL THEN
        RETURN '[]'::JSON;
    END IF;

    SELECT json_agg(row_to_json(t)) INTO result
    FROM (
        -- Events: use the precomputed fts_vector column
        SELECT
            'event' AS entity_type,
            e.id::TEXT AS id,
            e.title AS label,
            COALESCE(e.description, '') AS description,
            'event' AS sublabel,
            e.short_id AS short_id,
            NULL::TEXT AS slug,
            NULL::TEXT AS handle,
            NULL::TEXT AS first_name,
            NULL::TEXT AS last_name,
            NULL::TEXT AS avatar_url,
            NULL::TEXT AS club_name,
            ts_rank(e.fts_vector, ts_q) AS rank
        FROM public.events e
        WHERE e.fts_vector @@ ts_q
          AND e.status <> 'archived'
          AND e.status <> 'draft'

        UNION ALL

        -- Clubs: compute weighted FTS vector inline (no stored column)
        SELECT
            'club' AS entity_type,
            c.id::TEXT AS id,
            c.name AS label,
            COALESCE(c.description, '') AS description,
            'club' AS sublabel,
            NULL::TEXT AS short_id,
            c.slug AS slug,
            NULL::TEXT AS handle,
            NULL::TEXT AS first_name,
            NULL::TEXT AS last_name,
            COALESCE(c.logo_url, '') AS avatar_url,
            NULL::TEXT AS club_name,
            ts_rank(
                setweight(to_tsvector('english', coalesce(c.name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(c.description, '')), 'B'),
                ts_q
            ) AS rank
        FROM public.clubs c
        WHERE (
                setweight(to_tsvector('english', coalesce(c.name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(c.description, '')), 'B')
              ) @@ ts_q
          AND c.status = 'approved'
          AND c.visibility = 'public'
          AND c.is_archived = FALSE

        UNION ALL

        -- Profiles: compute weighted FTS vector inline (no stored column)
        SELECT
            'profile' AS entity_type,
            p.id::TEXT AS id,
            COALESCE(NULLIF(p.full_name, ''), '@' || COALESCE(p.handle, '')) AS label,
            COALESCE(p.bio, '') AS description,
            'user' AS sublabel,
            NULL::TEXT AS short_id,
            NULL::TEXT AS slug,
            p.handle AS handle,
            COALESCE(p.first_name, '') AS first_name,
            COALESCE(p.last_name, '') AS last_name,
            COALESCE(p.avatar_url, '') AS avatar_url,
            NULL::TEXT AS club_name,
            ts_rank(
                setweight(to_tsvector('english', coalesce(p.full_name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(p.bio, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(p.handle, '')), 'C'),
                ts_q
            ) AS rank
        FROM public.profiles p
        WHERE (
                setweight(to_tsvector('english', coalesce(p.full_name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(p.bio, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(p.handle, '')), 'C')
              ) @@ ts_q
          AND p.is_banned = FALSE
    ) t
    ORDER BY rank DESC, label ASC
    LIMIT 20;

    RETURN COALESCE(result, '[]'::JSON);
END;
$$;

GRANT EXECUTE ON FUNCTION public.global_search(TEXT) TO authenticated, anon;

COMMENT ON FUNCTION public.global_search(TEXT) IS
    'Unified full-text search across events, clubs, and profiles for the global Cmd+K palette.';
