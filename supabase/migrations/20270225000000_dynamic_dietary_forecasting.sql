-- ============================================================
-- Migration: 20270225000000_dynamic_dietary_forecasting.sql
-- Issue: #3931 — Implement 'Dynamic Dietary Restriction Forecasting'
--
-- Goals
--   1. `forecast_dietary_needs(event_id)` RPC — calculates the
--      current dietary breakdown from existing RSVPs, cross-references
--      with the club's historical average, applies a blended percentage
--      to the venue capacity, and returns a predictive report.
--
-- Methodology (Blended Forecast)
--   - current_pct  = (RSVPs with tag / total RSVPs) * 100
--   - historical_pct = avg % of that tag across the club's past events
--   - blended_pct = (current_pct * current_weight) + (historical_pct * historical_weight)
--       where current_weight = min(1, total_rsvps / 50) and
--       historical_weight = 1 - current_weight.
--       This means: with <50 RSVPs, historical data carries more weight;
--       with ≥50 RSVPs, current data dominates.
--   - forecast_meals = round(blended_pct / 100 * venue_capacity)
-- ============================================================

-- ─── 1. Helper: get historical dietary percentages for a club ──
CREATE OR REPLACE FUNCTION public._get_club_historical_dietary_pct(
    p_club_id UUID
)
RETURNS TABLE (
    dietary_tag TEXT,
    avg_percentage NUMERIC(5, 2),
    event_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN
    RETURN QUERY
    SELECT
        tag.dietary_tag,
        ROUND(AVG(tag.pct)::NUMERIC, 2) AS avg_percentage,
        COUNT(DISTINCT e.id)::INTEGER AS event_count
    FROM (
        SELECT
            e.id AS event_id,
            e.club_id,
            unnested.dietary_tag,
            CASE WHEN COUNT(DISTINCT r.user_id) > 0
                THEN (COUNT(DISTINCT CASE WHEN up.dietary_restrictions @> ARRAY[unnested.dietary_tag] THEN r.user_id END)::NUMERIC
                      / COUNT(DISTINCT r.user_id)::NUMERIC * 100)
                ELSE 0
            END AS pct
        FROM public.events e
        JOIN public.event_rsvps r ON r.event_id = e.id AND r.status = 'attending'
        JOIN public.user_preferences up ON up.user_id = r.user_id
        CROSS JOIN LATERAL UNNEST(
            CASE WHEN array_length(up.dietary_restrictions, 1) IS NOT NULL
                THEN up.dietary_restrictions
                ELSE ARRAY['none']::TEXT[]
            END
        ) AS unnested(dietary_tag)
        WHERE e.club_id = p_club_id
          AND e.event_date < NOW()
        GROUP BY e.id, e.club_id, unnested.dietary_tag
        HAVING COUNT(DISTINCT r.user_id) >= 10
    ) tag
    JOIN public.events e ON e.id = tag.event_id
    GROUP BY tag.dietary_tag;
END;
 $$;

GRANT EXECUTE ON FUNCTION public._get_club_historical_dietary_pct(UUID)
    TO authenticated;

-- ─── 2. Main RPC: forecast_dietary_needs(event_id) ─────────────
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
            JOIN public.user_preferences up ON up.user_id = r.user_id
            CROSS JOIN LATERAL UNNEST(
                CASE WHEN array_length(up.dietary_restrictions, 1) IS NOT NULL
                    THEN up.dietary_restrictions
                    ELSE ARRAY['none']::TEXT[]
                END
            ) AS unnested(dietary_tag)
            WHERE r.event_id = p_event_id
              AND r.status = 'attending'
            GROUP BY unnested.dietary_tag
        ) sub;
    ELSE
        v_current_tags := '[]'::JSONB;
    END IF;

    -- ── Historical breakdown ──────────────────────────────────
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'tag', dietary_tag,
        'avg_percentage', avg_percentage,
        'event_count', event_count
    ) ORDER BY avg_percentage DESC), '[]'::JSONB) INTO v_historical_tags
    FROM public._get_club_historical_dietary_pct(v_club_id);

    -- ── Blended forecast ──────────────────────────────────────
    v_current_weight := LEAST(1.0, v_total_rsvps::NUMERIC / 50.0);
    v_hist_weight := 1.0 - v_current_weight;

    SELECT COALESCE(array_agg(DISTINCT tag)) INTO v_all_tags
    FROM (
        SELECT jsonb_array_elements(v_current_tags)->>'tag' AS tag
        UNION ALL
        SELECT jsonb_array_elements(v_historical_tags)->>'tag' AS tag
    ) sub;

    FOREACH v_tag IN ARRAY v_all_tags LOOP
        SELECT COALESCE((jsonb_array_elements(v_current_tags)->>'percentage')::NUMERIC, 0)
          INTO v_current_pct
         WHERE jsonb_array_elements(v_current_tags)->>'tag' = v_tag;
        IF v_current_pct IS NULL THEN v_current_pct := 0; END IF;

        SELECT COALESCE((jsonb_array_elements(v_current_tags)->>'count')::INTEGER, 0)
          INTO v_current_count
         WHERE jsonb_array_elements(v_current_tags)->>'tag' = v_tag;
        IF v_current_count IS NULL THEN v_current_count := 0; END IF;

        SELECT COALESCE((jsonb_array_elements(v_historical_tags)->>'avg_percentage')::NUMERIC, 0)
          INTO v_hist_pct
         WHERE jsonb_array_elements(v_historical_tags)->>'tag' = v_tag;
        IF v_hist_pct IS NULL THEN v_hist_pct := 0; END IF;

        SELECT COALESCE((jsonb_array_elements(v_historical_tags)->>'event_count')::INTEGER, 0)
          INTO v_hist_count
         WHERE jsonb_array_elements(v_historical_tags)->>'tag' = v_tag;
        IF v_hist_count IS NULL THEN v_hist_count := 0; END IF;

        v_blended_pct := (v_current_pct * v_current_weight) + (v_hist_pct * v_hist_weight);
        v_forecast_meals := ROUND(v_blended_pct / 100.0 * v_venue_cap);

        v_blended_arr := v_blended_arr || jsonb_build_array(jsonb_build_object(
            'tag', v_tag,
            'current_percentage', ROUND(v_current_pct, 2),
            'historical_percentage', ROUND(v_hist_pct, 2),
            'blended_percentage', ROUND(v_blended_pct, 2),
            'current_count', v_current_count,
            'historical_event_count', v_hist_count,
            'forecast_meals', v_forecast_meals
        ));
    END LOOP;

    SELECT COALESCE(jsonb_agg(elem ORDER BY (elem->>'forecast_meals')::INTEGER DESC), '[]'::JSONB)
      INTO v_blended_arr
      FROM jsonb_array_elements(v_blended_arr) AS elem;

    -- ── Human-readable summary ────────────────────────────────
    SELECT string_agg(
        CASE
            WHEN (elem->>'forecast_meals')::INTEGER > 0
            THEN (elem->>'forecast_meals') || ' ' || (elem->>'tag') || ' meals'
            ELSE NULL
        END,
        ', '
    ) INTO v_summary
    FROM jsonb_array_elements(v_blended_arr) AS elem;

    IF v_summary IS NULL OR v_summary = '' THEN
        v_summary := 'No dietary forecast available — encourage attendees to set dietary preferences.';
    ELSE
        v_summary := 'Based on current trends, expect to need ' || v_summary || '. Give this number to your caterer.';
    END IF;

    RETURN json_build_object(
        'ok', true,
        'event_id', p_event_id,
        'event_title', v_event.title,
        'venue_capacity', v_venue_cap,
        'total_rsvps', v_total_rsvps,
        'current_weight', ROUND(v_current_weight, 2),
        'historical_weight', ROUND(v_hist_weight, 2),
        'current_breakdown', v_current_tags,
        'historical_breakdown', v_historical_tags,
        'blended_forecast', v_blended_arr,
        'summary', v_summary
    );
END;
 $$;

GRANT EXECUTE ON FUNCTION public.forecast_dietary_needs(UUID)
    TO authenticated;
