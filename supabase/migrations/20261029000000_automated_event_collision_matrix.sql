-- Migration: 20261029000000_automated_event_collision_matrix.sql
-- Description: Create get_event_collision_matrix RPC and ensure semesters schema exists (#3320).

-- Ensure semesters table exists
CREATE TABLE IF NOT EXISTS public.semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create RPC function to calculate 7x24 event collision densities
CREATE OR REPLACE FUNCTION public.get_event_collision_matrix(p_semester_id UUID DEFAULT NULL)
RETURNS TABLE (
    day_of_week INT,
    hour_of_day INT,
    concurrent_events BIGINT,
    total_attendees BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
BEGIN
    -- Resolve semester bounds if provided
    IF p_semester_id IS NOT NULL THEN
        SELECT start_date, end_date INTO v_start, v_end
        FROM public.semesters
        WHERE id = p_semester_id;
    END IF;

    -- Return full 7x24 grid
    RETURN QUERY
    WITH slots AS (
        SELECT d.day AS s_day, h.hour AS s_hour
        FROM generate_series(1, 7) AS d(day)
        CROSS JOIN generate_series(0, 23) AS h(hour)
    ),
    event_counts AS (
        SELECT 
            EXTRACT(isodow FROM e.start_time)::int AS e_day,
            EXTRACT(hour FROM e.start_time)::int AS e_hour,
            COUNT(DISTINCT e.id)::bigint AS cnt,
            COALESCE(SUM(attendee_counts.cnt), 0)::bigint AS att
        FROM public.events e
        LEFT JOIN (
            SELECT event_id, COUNT(*)::bigint AS cnt
            FROM public.event_rsvps
            WHERE status = 'attending'
            GROUP BY event_id
        ) attendee_counts ON e.id = attendee_counts.event_id
        WHERE e.deleted_at IS NULL
          AND e.status = 'published'
          AND (v_start IS NULL OR e.start_time >= v_start)
          AND (v_end IS NULL OR e.start_time <= v_end)
        GROUP BY e_day, e_hour
    )
    SELECT 
        slots.s_day AS day_of_week,
        slots.s_hour AS hour_of_day,
        COALESCE(event_counts.cnt, 0)::bigint AS concurrent_events,
        COALESCE(event_counts.att, 0)::bigint AS total_attendees
    FROM slots
    LEFT JOIN event_counts ON slots.s_day = event_counts.e_day AND slots.s_hour = event_counts.e_hour
    ORDER BY day_of_week ASC, hour_of_day ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_collision_matrix(UUID) TO authenticated;
