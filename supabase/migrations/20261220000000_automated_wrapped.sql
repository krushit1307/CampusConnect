-- Migration: 20261220000000_automated_wrapped.sql
-- Description: Implement get_yearly_wrapped RPC function for Spotify-Wrapped equivalent physical engagement presentation (#3552).

CREATE OR REPLACE FUNCTION public.get_yearly_wrapped(p_user_id UUID, p_year INT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_events_attended INT;
    v_total_hours_spent NUMERIC;
    v_top_tag TEXT;
    v_gamification_percentile INT;
    v_top_events JSONB;
BEGIN
    -- 1. Total events attended (checked in)
    SELECT COALESCE(COUNT(*), 0)::INT
    INTO v_total_events_attended
    FROM public.event_rsvps r
    WHERE r.user_id = p_user_id
      AND r.checked_in = TRUE
      AND EXTRACT(YEAR FROM r.rsvp_at) = p_year;

    -- 2. Total hours spent at events
    SELECT COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 3600)), 0)::NUMERIC
    INTO v_total_hours_spent
    FROM public.event_rsvps r
    JOIN public.events e ON r.event_id = e.id
    WHERE r.user_id = p_user_id
      AND r.checked_in = TRUE
      AND EXTRACT(YEAR FROM r.rsvp_at) = p_year;

    -- 3. Top tag
    SELECT tag
    INTO v_top_tag
    FROM (
        SELECT unnest(e.tags) AS tag
        FROM public.event_rsvps r
        JOIN public.events e ON r.event_id = e.id
        WHERE r.user_id = p_user_id
          AND r.checked_in = TRUE
          AND EXTRACT(YEAR FROM r.rsvp_at) = p_year
    ) t
    GROUP BY tag
    ORDER BY COUNT(*) DESC, tag ASC
    LIMIT 1;

    -- 4. Gamification percentile rank
    IF EXISTS (
        SELECT 1 FROM public.gamification_points WHERE user_id = p_user_id
    ) THEN
        WITH active_scores AS (
            SELECT user_id, SUM(
                CASE 
                    WHEN gp.created_at >= NOW() - INTERVAL '3 months' THEN gp.points * 1.0
                    WHEN gp.created_at >= NOW() - INTERVAL '6 months' THEN gp.points * 0.5
                    ELSE gp.points * 0.1
                END
            ) AS score
            FROM public.gamification_points gp
            GROUP BY user_id
        ),
        ranks AS (
            SELECT user_id, PERCENT_RANK() OVER (ORDER BY score ASC) AS pct
            FROM active_scores
        )
        SELECT COALESCE(ROUND((1 - pct) * 100)::INT, 1)
        INTO v_gamification_percentile
        FROM ranks
        WHERE ranks.user_id = p_user_id;
    ELSE
        v_gamification_percentile := 100;
    END IF;

    -- 5. Top 3 events attended (ordered by most recent)
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
    INTO v_top_events
    FROM (
        SELECT e.title, COALESCE(e.cover_image_url, '') AS cover_image_url
        FROM public.event_rsvps r
        JOIN public.events e ON r.event_id = e.id
        WHERE r.user_id = p_user_id
          AND r.checked_in = TRUE
          AND EXTRACT(YEAR FROM r.rsvp_at) = p_year
        ORDER BY r.rsvp_at DESC
        LIMIT 3
    ) sub;

    RETURN jsonb_build_object(
        'total_events_attended', COALESCE(v_total_events_attended, 0),
        'total_hours_spent', COALESCE(v_total_hours_spent, 0),
        'top_tag', COALESCE(v_top_tag, 'Tech'),
        'gamification_percentile', COALESCE(v_gamification_percentile, 100),
        'top_events', v_top_events
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_yearly_wrapped(UUID, INT) TO authenticated, service_role;
