-- Migration: event_conflict_dashboard
-- Description: Creates check_schedule_conflict and get_user_schedule_conflicts RPC functions.

-- 1. Create check_schedule_conflict function
CREATE OR REPLACE FUNCTION public.check_schedule_conflict(
    p_user_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_include_buffer BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    conflict_event_id UUID,
    conflict_event_title TEXT,
    conflict_start_date TIMESTAMPTZ,
    conflict_end_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_buffer INTERVAL;
BEGIN
    v_buffer := CASE WHEN p_include_buffer THEN INTERVAL '15 minutes' ELSE INTERVAL '0 minutes' END;
    
    RETURN QUERY
    SELECT 
        e.id AS conflict_event_id,
        e.title AS conflict_event_title,
        COALESCE(e.start_date, e.event_date) AS conflict_start_date,
        COALESCE(e.end_date, e.start_date + INTERVAL '1 hour') AS conflict_end_date
    FROM public.event_rsvps r
    JOIN public.events e ON r.event_id = e.id
    WHERE r.user_id = p_user_id
      AND e.deleted_at IS NULL
      AND (
          (p_start_time, p_end_time + v_buffer) 
          OVERLAPS 
          (COALESCE(e.start_date, e.event_date), COALESCE(e.end_date, e.start_date + INTERVAL '1 hour') + v_buffer)
      );
END;
$$;

-- 2. Create get_user_schedule_conflicts function
CREATE OR REPLACE FUNCTION public.get_user_schedule_conflicts(
    p_user_id UUID,
    p_include_buffer BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    event_id UUID,
    event_title TEXT,
    event_start_date TIMESTAMPTZ,
    event_end_date TIMESTAMPTZ,
    conflict_event_id UUID,
    conflict_event_title TEXT,
    conflict_start_date TIMESTAMPTZ,
    conflict_end_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_buffer INTERVAL;
BEGIN
    v_buffer := CASE WHEN p_include_buffer THEN INTERVAL '15 minutes' ELSE INTERVAL '0 minutes' END;

    RETURN QUERY
    SELECT 
        e1.id AS event_id,
        e1.title AS event_title,
        COALESCE(e1.start_date, e1.event_date) AS event_start_date,
        COALESCE(e1.end_date, e1.start_date + INTERVAL '1 hour') AS event_end_date,
        e2.id AS conflict_event_id,
        e2.title AS conflict_event_title,
        COALESCE(e2.start_date, e2.event_date) AS conflict_start_date,
        COALESCE(e2.end_date, e2.start_date + INTERVAL '1 hour') AS conflict_end_date
    FROM public.event_rsvps r1
    JOIN public.events e1 ON r1.event_id = e1.id
    JOIN public.event_rsvps r2 ON r1.user_id = r2.user_id
    JOIN public.events e2 ON r2.event_id = e2.id
    WHERE r1.user_id = p_user_id
      AND e1.deleted_at IS NULL
      AND e2.deleted_at IS NULL
      AND e1.id < e2.id
      AND (
          (COALESCE(e1.start_date, e1.event_date), COALESCE(e1.end_date, e1.start_date + INTERVAL '1 hour') + v_buffer) 
          OVERLAPS 
          (COALESCE(e2.start_date, e2.event_date), COALESCE(e2.end_date, e2.start_date + INTERVAL '1 hour') + v_buffer)
      );
END;
$$;

-- 3. Grant execution permissions
GRANT EXECUTE ON FUNCTION public.check_schedule_conflict TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_schedule_conflicts TO authenticated, anon;
