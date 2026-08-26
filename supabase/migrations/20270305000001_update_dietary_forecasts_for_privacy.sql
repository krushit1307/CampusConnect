CREATE OR REPLACE FUNCTION public.forecast_dietary_needs(
    p_event_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ DECLARE
    v_event        RECORD;
    v_club_id      UUID;
    v_venue_cap    INTEGER;
    v_total_rsvps  INTEGER;
    v_current_weight NUMERIC;
    v_hist_weight  NUMERIC;
    v_current_tags JSONB;
    v_historical_tags JSONB;
    v_all_tags     TEXT[];
    v_tag          TEXT;
    v_current_pct  NUMERIC;
    v_hist_pct     NUMERIC;
    v_blended_pct  NUMERIC;
    v_forecast_meals INTEGER;
    v_current_count INTEGER;
    v_hist_count   INTEGER;
    v_current_arr  JSONB := '[]'::JSONB;
    v_historical_arr JSONB := '[]'::JSONB;
    v_blended_arr  JSONB := '[]'::JSONB;
    v_summary      TEXT;
BEGIN
    SELECT id, club_id, COALESCE(venue_capacity, max_attendees, 0) AS capacity, title
      INTO v_event
      FROM public.events
     WHERE id = p_event_id;

    IF NOT FOUND THEN
        RETURN json_build_object('ok', false, 'error', 'Event not found');
    END IF;

    v_club_id := v_event.club_id;
    v_venue_cap := v_event.capacity;

    IF v_venue_cap <= 0 THEN
        RETURN json_build_object(
            'ok', false,
            'error', 'Venue capacity is not set for this event. Set venue_capacity or max_attendees first.'
        );
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_total_rsvps
      FROM public.event_rsvps
     WHERE event_id = p_event_id
       AND status = 'attending';

    -- ── Current breakdown ──────────────────────────────────────
    IF v_total_rsvps > 0 THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'tag', tag,
            'count', cnt,
            'percentage', ROUND(pct, 2)
        ) ORDER BY pct DESC), '[]'::JSONB) INTO v_current_tags
        FROM (
            SELECT
                unnested.dietary_tag AS tag,
                COUNT(DISTINCT r.user_id)::INTEGER AS cnt,
                (COUNT(DISTINCT r.user_id)::NUMERIC / v_total_rsvps * 100) AS pct
            FROM public.event_rsvps r
            CROSS JOIN LATERAL UNNEST(
                CASE WHEN array_length(r.dietary_restrictions, 1) IS NOT NULL
                    THEN r.dietary_restrictions
                    ELSE ARRAY['none']::TEXT[]
                END
            ) AS unnested(dietary_tag)
            WHERE r.event_id = p_event_id
              AND r.status = 'attending'
            GROUP BY unnested.dietary_tag
        ) AS current_stats;
    ELSE
        v_current_tags := '[]'::JSONB;
    END IF;

    -- ── Historical breakdown (Club Level) ──────────────────────
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'tag', tag,
        'count', cnt,
        'percentage', ROUND(pct, 2)
    ) ORDER BY pct DESC), '[]'::JSONB) INTO v_historical_tags
    FROM (
        SELECT
            unnested.dietary_tag AS tag,
            COUNT(DISTINCT r.user_id)::INTEGER AS cnt,
            (COUNT(DISTINCT r.user_id)::NUMERIC / NULLIF(
                (SELECT COUNT(DISTINCT hr.user_id)
                 FROM public.event_rsvps hr
                 JOIN public.events he ON he.id = hr.event_id
                 WHERE he.club_id = v_club_id AND hr.status = 'attending'
                ), 0) * 100) AS pct
        FROM public.event_rsvps r
        JOIN public.events e ON e.id = r.event_id
        CROSS JOIN LATERAL UNNEST(
            CASE WHEN array_length(r.dietary_restrictions, 1) IS NOT NULL
                THEN r.dietary_restrictions
                ELSE ARRAY['none']::TEXT[]
            END
        ) AS unnested(dietary_tag)
        WHERE e.club_id = v_club_id
          AND r.status = 'attending'
        GROUP BY unnested.dietary_tag
    ) AS hist_stats;

    -- ── Blend & Forecast ───────────────────────────────────────
    IF v_total_rsvps >= (v_venue_cap * 0.8) THEN
        v_current_weight := 1.0;
        v_hist_weight    := 0.0;
        v_summary := 'Using 100% current RSVPs (event is mostly full).';
    ELSIF v_total_rsvps = 0 THEN
        v_current_weight := 0.0;
        v_hist_weight    := 1.0;
        v_summary := 'Using 100% historical data (0 current RSVPs).';
    ELSE
        v_current_weight := (v_total_rsvps::NUMERIC / v_venue_cap);
        v_hist_weight    := 1.0 - v_current_weight;
        v_summary := FORMAT('Blending current (%.0f%%) and historical (%.0f%%) patterns based on %s/%s RSVPs.', 
                            v_current_weight * 100, v_hist_weight * 100, v_total_rsvps, v_venue_cap);
    END IF;

    SELECT ARRAY(
        SELECT jsonb_array_elements(v_current_tags)->>'tag'
        UNION
        SELECT jsonb_array_elements(v_historical_tags)->>'tag'
    ) INTO v_all_tags;

    IF array_length(v_all_tags, 1) > 0 THEN
        FOREACH v_tag IN ARRAY v_all_tags
        LOOP
            SELECT COALESCE((jsonb_array_elements(v_current_tags)->>'percentage')::NUMERIC, 0),
                   COALESCE((jsonb_array_elements(v_current_tags)->>'count')::INTEGER, 0)
              INTO v_current_pct, v_current_count
              FROM (SELECT v_current_tags AS arr) t
             WHERE v_current_tags @> jsonb_build_array(jsonb_build_object('tag', v_tag));

            IF NOT FOUND THEN
                v_current_pct := 0; v_current_count := 0;
            END IF;

            SELECT COALESCE((jsonb_array_elements(v_historical_tags)->>'percentage')::NUMERIC, 0),
                   COALESCE((jsonb_array_elements(v_historical_tags)->>'count')::INTEGER, 0)
              INTO v_hist_pct, v_hist_count
              FROM (SELECT v_historical_tags AS arr) t
             WHERE v_historical_tags @> jsonb_build_array(jsonb_build_object('tag', v_tag));

            IF NOT FOUND THEN
                v_hist_pct := 0; v_hist_count := 0;
            END IF;

            v_blended_pct := (v_current_pct * v_current_weight) + (v_hist_pct * v_hist_weight);
            v_forecast_meals := CEIL((v_blended_pct / 100) * v_venue_cap);

            IF v_current_count > 0 THEN
                v_current_arr := v_current_arr || jsonb_build_object('tag', v_tag, 'count', v_current_count, 'percentage', ROUND(v_current_pct, 1));
            END IF;
            IF v_hist_count > 0 THEN
                v_historical_arr := v_historical_arr || jsonb_build_object('tag', v_tag, 'count', v_hist_count, 'percentage', ROUND(v_hist_pct, 1));
            END IF;
            IF v_forecast_meals > 0 THEN
                v_blended_arr := v_blended_arr || jsonb_build_object('tag', v_tag, 'forecasted_meals', v_forecast_meals, 'blended_percentage', ROUND(v_blended_pct, 1));
            END IF;
        END LOOP;
    END IF;

    RETURN json_build_object(
        'ok', true,
        'event_id', p_event_id,
        'title', v_event.title,
        'capacity', v_venue_cap,
        'total_rsvps', v_total_rsvps,
        'summary', v_summary,
        'current_breakdown', v_current_arr,
        'historical_breakdown', v_historical_arr,
        'forecast_breakdown', v_blended_arr
    );
END;
$$;

CREATE OR REPLACE FUNCTION get_dietary_restriction_heatmap_data(
    p_dietary_tag TEXT DEFAULT NULL,
    p_time_window_start TIMESTAMPTZ DEFAULT NOW(),
    p_time_window_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '4 hours')
)
RETURNS TABLE (
    venue_id UUID,
    venue_name TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    dietary_tag TEXT,
    student_count BIGINT,
    intensity_weight NUMERIC(5, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.venue_id,
        e.venue_name,
        e.latitude,
        e.longitude,
        unnested_tag.dietary_tag,
        COUNT(DISTINCT r.user_id) AS student_count,
        ROUND(LEAST(1.00, COUNT(DISTINCT r.user_id)::numeric / 100.00), 2) AS intensity_weight
    FROM events e
    JOIN event_rsvps r ON r.event_id = e.id
    CROSS JOIN LATERAL UNNEST(
        CASE WHEN array_length(r.dietary_restrictions, 1) IS NOT NULL
            THEN r.dietary_restrictions
            ELSE ARRAY['none']::TEXT[]
        END
    ) AS unnested_tag(dietary_tag)
    WHERE r.status IN ('attending', 'attended')
      AND e.event_date <= p_time_window_end
      AND e.event_date >= p_time_window_start
      AND (p_dietary_tag IS NULL OR LOWER(unnested_tag.dietary_tag) = LOWER(p_dietary_tag))
    GROUP BY e.venue_id, e.venue_name, e.latitude, e.longitude, unnested_tag.dietary_tag;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
