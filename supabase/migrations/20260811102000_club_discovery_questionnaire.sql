-- Migration: 20260811102000_club_discovery_questionnaire.sql
-- Description: Add get_club_recommendations RPC for Club Discovery Questionnaire

CREATE OR REPLACE FUNCTION public.get_club_recommendations(user_answers JSONB)
RETURNS TABLE (
    club_id UUID,
    name TEXT,
    slug TEXT,
    description TEXT,
    logo_url TEXT,
    match_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_interests TEXT[];
    user_time_commitment TEXT;
    user_major TEXT;
    matches_count INT;
BEGIN
    -- Extract values from JSONB
    user_interests := ARRAY(SELECT jsonb_array_elements_text(user_answers->'interests'));
    user_time_commitment := user_answers->>'time_commitment';
    user_major := user_answers->>'major';

    RETURN QUERY
    WITH club_scores AS (
        SELECT 
            c.id AS cid,
            c.name AS cname,
            c.slug AS cslug,
            c.description AS cdescription,
            c.logo_url AS clogo_url,
            -- Calculate overlap of tags
            (
                SELECT COUNT(*)::NUMERIC 
                FROM public.club_tags ct
                JOIN public.club_tag_labels ctl ON ct.tag_id = ctl.id
                WHERE ct.club_id = c.id
                AND (
                    ctl.name = ANY(user_interests)
                    OR ctl.name = user_time_commitment
                    OR ctl.name = user_major
                    OR ctl.name ILIKE '%' || user_time_commitment || '%'
                    OR ctl.name ILIKE '%' || user_major || '%'
                )
            ) AS match_count,
            -- Check if club is active (has an event in the last 6 months)
            EXISTS (
                SELECT 1 FROM public.events e
                WHERE e.club_id = c.id
                AND e.start_date >= NOW() - INTERVAL '6 months'
            ) AS is_active
        FROM public.clubs c
        WHERE c.visibility = 'public'
    ),
    scored_clubs AS (
        SELECT 
            cid,
            cname,
            cslug,
            cdescription,
            clogo_url,
            -- penalize dead clubs by multiplying score by 0.1
            CASE 
                WHEN is_active THEN match_count
                ELSE match_count * 0.1
            END AS final_score
        FROM club_scores
    )
    SELECT 
        cid,
        cname,
        cslug,
        cdescription,
        clogo_url,
        -- Calculate percentage (cap at 100)
        ROUND(LEAST(100.0, (final_score / COALESCE(NULLIF(ARRAY_LENGTH(user_interests, 1), 0), 1) * 100.0)), 2) AS match_percentage
    FROM scored_clubs
    WHERE final_score > 0
    ORDER BY final_score DESC, cname ASC
    LIMIT 5;

    -- If no matches found, fallback to popular clubs
    GET DIAGNOSTICS matches_count = ROW_COUNT;
    IF matches_count = 0 THEN
        RETURN QUERY
        SELECT 
            c.id AS cid,
            c.name AS cname,
            c.slug AS cslug,
            c.description AS cdescription,
            c.logo_url AS clogo_url,
            80.00::NUMERIC AS match_percentage
        FROM public.clubs c
        WHERE c.visibility = 'public'
        LIMIT 5;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_recommendations(JSONB) TO anon, authenticated;
