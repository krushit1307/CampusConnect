-- Migration: 20261231000015_dynamic_commute_time_warning.sql
-- Description: Dynamic "Commute Time" RSVP Warning - Function to detect spatial-temporal travel conflicts (#3594)

CREATE OR REPLACE FUNCTION public.check_commute_rsvp_conflicts(
    p_user_id UUID,
    p_event_id UUID,
    p_walking_speed_kmh DOUBLE PRECISION DEFAULT 4.8
)
RETURNS TABLE (
    conflict_event_id UUID,
    conflict_event_title TEXT,
    conflict_type TEXT,
    temporal_gap_minutes INT,
    distance_miles DOUBLE PRECISION,
    distance_km DOUBLE PRECISION,
    estimated_travel_minutes INT,
    warning_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_lat DOUBLE PRECISION;
    v_target_lon DOUBLE PRECISION;
    v_target_start TIMESTAMPTZ;
    v_target_end TIMESTAMPTZ;
    v_target_title TEXT;
BEGIN
    SELECT 
        latitude, 
        longitude, 
        COALESCE(start_date, event_date), 
        COALESCE(end_date, start_date + INTERVAL '1 hour', event_date + INTERVAL '1 hour'),
        title
    INTO 
        v_target_lat, 
        v_target_lon, 
        v_target_start, 
        v_target_end,
        v_target_title
    FROM public.events
    WHERE id = p_event_id;

    IF v_target_lat IS NULL OR v_target_lon IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH user_events AS (
        SELECT 
            e.id AS ev_id,
            e.title AS ev_title,
            e.latitude AS ev_lat,
            e.longitude AS ev_lon,
            COALESCE(e.start_date, e.event_date) AS ev_start,
            COALESCE(e.end_date, e.start_date + INTERVAL '1 hour', e.event_date + INTERVAL '1 hour') AS ev_end
        FROM public.event_rsvps r
        JOIN public.events e ON r.event_id = e.id
        WHERE r.user_id = p_user_id
          AND e.id != p_event_id
          AND e.deleted_at IS NULL
          AND e.latitude IS NOT NULL
          AND e.longitude IS NOT NULL
          AND DATE(COALESCE(e.start_date, e.event_date)) = DATE(v_target_start)
    ),
    evaluated AS (
        SELECT 
            ue.ev_id,
            ue.ev_title,
            ue.ev_start,
            ue.ev_end,
            public.haversine_distance(v_target_lat, v_target_lon, ue.ev_lat, ue.ev_lon) AS dist_km,
            ROUND(((public.haversine_distance(v_target_lat, v_target_lon, ue.ev_lat, ue.ev_lon) * 0.621371)::NUMERIC), 1)::DOUBLE PRECISION AS dist_mi,
            CEIL((public.haversine_distance(v_target_lat, v_target_lon, ue.ev_lat, ue.ev_lon) / p_walking_speed_kmh) * 60)::INT AS travel_mins,
            CASE 
                WHEN v_target_start >= ue.ev_end THEN 'before'
                WHEN ue.ev_start >= v_target_end THEN 'after'
                ELSE 'overlap'
            END AS c_type,
            CASE 
                WHEN v_target_start >= ue.ev_end THEN EXTRACT(EPOCH FROM (v_target_start - ue.ev_end)) / 60
                WHEN ue.ev_start >= v_target_end THEN EXTRACT(EPOCH FROM (ue.ev_start - v_target_end)) / 60
                ELSE 0
            END::INT AS gap_mins
        FROM user_events ue
    )
    SELECT 
        e.ev_id AS conflict_event_id,
        e.ev_title AS conflict_event_title,
        e.c_type AS conflict_type,
        e.gap_mins AS temporal_gap_minutes,
        e.dist_mi AS distance_miles,
        e.dist_km AS distance_km,
        e.travel_mins AS estimated_travel_minutes,
        ('Warning: You only have ' || e.gap_mins || ' minute(s) to travel ' || e.dist_mi || ' miles across campus. You may be late to this event.')::TEXT AS warning_message
    FROM evaluated e
    WHERE e.c_type IN ('before', 'after')
      AND e.gap_mins <= 120
      AND e.travel_mins > e.gap_mins;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_commute_rsvp_conflicts TO authenticated, anon;
