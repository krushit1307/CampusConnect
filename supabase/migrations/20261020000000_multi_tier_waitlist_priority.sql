-- Migration: 20261020000000_multi_tier_waitlist_priority.sql
-- Description: Implement demographic waitlist priority algorithm, adding columns and updating promotion functions.

-- 1. Alter tables
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS priority_rules JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS graduation_year INTEGER;

-- 2. Update promote_waitlist_attendee trigger to use priority algorithm
CREATE OR REPLACE FUNCTION public.promote_waitlist_attendee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_waitlist_record RECORD;
    v_priority_rules JSONB;
    v_current_year INTEGER;
BEGIN
    -- Get priority rules for this event
    SELECT priority_rules INTO v_priority_rules FROM public.events WHERE id = OLD.event_id;
    v_current_year := EXTRACT(YEAR FROM NOW())::INTEGER;

    -- Find and lock the highest priority waitlist record for the event
    -- Algorithm: Base(100) - Time Waited (hours) + Graduating Senior (500)
    SELECT 
        w.id, 
        w.event_id, 
        w.user_id 
    INTO next_waitlist_record
    FROM public.event_waitlist w
    JOIN public.profiles p ON p.id = w.user_id
    WHERE w.event_id = OLD.event_id
    ORDER BY
        (
            100.0
            - (EXTRACT(EPOCH FROM (NOW() - w.created_at)) / 3600.0)
            + CASE 
                WHEN (v_priority_rules->>'prioritize_seniors')::boolean = true 
                     AND p.graduation_year = v_current_year 
                THEN 500.0 
                ELSE 0.0 
              END
        ) DESC,
        -- Strictly chronological tie-breaker (oldest registration first)
        w.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- If a waitlisted student exists, promote them to active RSVP and remove from waitlist
    IF FOUND THEN
        INSERT INTO public.event_rsvps (event_id, user_id)
        VALUES (next_waitlist_record.event_id, next_waitlist_record.user_id)
        ON CONFLICT (event_id, user_id) DO NOTHING;

        DELETE FROM public.event_waitlist
        WHERE id = next_waitlist_record.id;
    END IF;

    RETURN OLD;
END;
$$;

-- 3. Refactor get_waitlist_score RPC for the frontend
CREATE OR REPLACE FUNCTION public.get_waitlist_score(
    p_event_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    waitlist_hours NUMERIC,
    time_score NUMERIC,
    senior_score NUMERIC,
    total_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_priority_rules JSONB;
    v_current_year INTEGER;
BEGIN
    SELECT priority_rules INTO v_priority_rules FROM public.events WHERE id = p_event_id;
    v_current_year := EXTRACT(YEAR FROM NOW())::INTEGER;

    RETURN QUERY
    SELECT
        ROUND((EXTRACT(EPOCH FROM (NOW() - w.created_at)) / 3600)::numeric, 2) AS waitlist_hours,
        ROUND((-1.0 * (EXTRACT(EPOCH FROM (NOW() - w.created_at)) / 3600))::numeric, 2) AS time_score,
        CASE
            WHEN (v_priority_rules->>'prioritize_seniors')::boolean = true 
                 AND p.graduation_year = v_current_year 
            THEN 500.0 
            ELSE 0.0
        END::numeric AS senior_score,
        ROUND((
            100.0
            - (EXTRACT(EPOCH FROM (NOW() - w.created_at)) / 3600.0)
            + CASE 
                WHEN (v_priority_rules->>'prioritize_seniors')::boolean = true 
                     AND p.graduation_year = v_current_year 
                THEN 500.0 
                ELSE 0.0 
              END
        )::numeric, 2) AS total_score
    FROM public.event_waitlist w
    JOIN public.profiles p ON p.id = w.user_id
    WHERE w.event_id = p_event_id
      AND w.user_id = p_user_id;
END;
$$;
