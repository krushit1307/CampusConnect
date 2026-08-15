-- ============================================================
-- Migration: 20260810000001_clubs_pagination_rpc.sql
-- Issue: #924
-- Description:
--   Creates a function to fetch clubs with server-side filtering
--   for category, tags (AND logic), and search terms.
--   Returns SETOF public.clubs so PostgREST can apply .select()
--   for relations and .range() for offset/limit pagination.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_filtered_clubs(
    p_search TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_tags TEXT[] DEFAULT NULL
) RETURNS SETOF public.clubs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_search IS NOT NULL AND TRIM(p_search) <> '' THEN
        -- Leverage the existing fuzzy search RPC which already handles ordering by relevance
        RETURN QUERY
        SELECT c.*
        FROM public.search_clubs(p_search) c
        WHERE 
            (c.deleted_at IS NULL) AND
            (p_category IS NULL OR EXISTS (SELECT 1 FROM public.club_categories cc WHERE cc.id = c.category_id AND cc.name ILIKE p_category)) AND
            (
                p_tags IS NULL OR array_length(p_tags, 1) IS NULL OR
                p_tags <@ (
                    SELECT coalesce(array_agg(lower(ctl.name)), '{}'::text[])
                    FROM public.club_tags ct
                    JOIN public.club_tag_labels ctl ON ct.tag_id = ctl.id
                    WHERE ct.club_id = c.id
                )
            );
    ELSE
        RETURN QUERY
        SELECT c.*
        FROM public.clubs c
        WHERE 
            (c.deleted_at IS NULL) AND
            (p_category IS NULL OR EXISTS (SELECT 1 FROM public.club_categories cc WHERE cc.id = c.category_id AND cc.name ILIKE p_category)) AND
            (
                p_tags IS NULL OR array_length(p_tags, 1) IS NULL OR
                p_tags <@ (
                    SELECT coalesce(array_agg(lower(ctl.name)), '{}'::text[])
                    FROM public.club_tags ct
                    JOIN public.club_tag_labels ctl ON ct.tag_id = ctl.id
                    WHERE ct.club_id = c.id
                )
            )
        ORDER BY c.name ASC;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_filtered_clubs(TEXT, TEXT, TEXT[]) TO authenticated, anon;
