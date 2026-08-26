-- Migration: 20260731100000_relay_cursor_pagination.sql
-- Description: Create Relay-style cursor pagination RPC function for feed posts returning edges, node, and pageInfo.

CREATE OR REPLACE FUNCTION public.get_posts_relay(
    p_after TEXT DEFAULT NULL,
    p_first INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_last_created_at TIMESTAMPTZ;
    v_last_id UUID;
    v_decoded TEXT;
    v_parts TEXT[];
    v_limit INT := GREATEST(1, LEAST(COALESCE(p_first, 10), 100));
    v_record RECORD;
    v_count INT := 0;
    v_has_next_page BOOLEAN := FALSE;
    v_has_previous_page BOOLEAN := FALSE;
    v_edges JSONB := '[]'::JSONB;
    v_start_cursor TEXT := NULL;
    v_end_cursor TEXT := NULL;
    v_cursor TEXT;
BEGIN
    -- 1. Decode p_after cursor if provided (base64 string "created_at,id")
    IF p_after IS NOT NULL AND p_after <> '' THEN
        v_has_previous_page := TRUE;
        BEGIN
            v_decoded := convert_from(decode(p_after, 'base64'), 'UTF-8');
            v_parts := string_to_array(v_decoded, ',');
            IF array_length(v_parts, 1) >= 2 THEN
                v_last_created_at := v_parts[1]::TIMESTAMPTZ;
                v_last_id := v_parts[2]::UUID;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_last_created_at := NULL;
            v_last_id := NULL;
        END;
    END IF;

    -- 2. Query v_limit + 1 posts to accurately determine hasNextPage
    FOR v_record IN
        SELECT p.*
        FROM public.posts p
        WHERE p.deleted_at IS NULL
          AND (
            v_last_created_at IS NULL 
            OR v_last_id IS NULL 
            OR (p.created_at, p.id) < (v_last_created_at, v_last_id)
          )
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT (v_limit + 1)
    LOOP
        v_count := v_count + 1;
        IF v_count <= v_limit THEN
            v_cursor := encode(convert_to(v_record.created_at::text || ',' || v_record.id::text, 'UTF-8'), 'base64');
            
            IF v_start_cursor IS NULL THEN
                v_start_cursor := v_cursor;
            END IF;
            v_end_cursor := v_cursor;

            v_edges := v_edges || jsonb_build_object(
                'cursor', v_cursor,
                'node', to_jsonb(v_record)
            );
        ELSE
            v_has_next_page := TRUE;
        END IF;
    END LOOP;

    -- 3. Construct Relay Connection JSON response
    RETURN jsonb_build_object(
        'edges', v_edges,
        'pageInfo', jsonb_build_object(
            'hasNextPage', v_has_next_page,
            'hasPreviousPage', v_has_previous_page,
            'startCursor', v_start_cursor,
            'endCursor', v_end_cursor
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_posts_relay(TEXT, INT) TO authenticated, anon, service_role;
