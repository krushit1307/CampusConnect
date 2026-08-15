-- ============================================================
-- Migration: 20260828000000_waitlist_priority.sql
-- Issue: #2873
-- Description: Implement waitlist priority algorithm replacing FIFO.
-- ============================================================

-- 1. Create the engagement cache table
CREATE TABLE IF NOT EXISTS public.club_member_engagement (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,

    is_active_member BOOLEAN NOT NULL DEFAULT FALSE,
    attendance_streak_weeks INTEGER NOT NULL DEFAULT 0,
    is_graduating_senior BOOLEAN NOT NULL DEFAULT FALSE,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_club_engagement_lookup
ON public.club_member_engagement(club_id, user_id);

-- Enable RLS on it
ALTER TABLE public.club_member_engagement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Engagement scores are viewable by everyone." 
ON public.club_member_engagement FOR SELECT USING (true);


-- 2. Update promote_waitlist_attendee trigger to use priority algorithm
CREATE OR REPLACE FUNCTION public.promote_waitlist_attendee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_waitlist_record RECORD;
BEGIN
    -- Find and lock the highest priority waitlist record for the event
    -- Algorithm: Time Waited (hours) + Member(50) + Streak(5*weeks) + Senior(20)
    SELECT 
        w.id, 
        w.event_id, 
        w.user_id 
    INTO next_waitlist_record
    FROM public.event_waitlist w
    JOIN public.events e ON e.id = w.event_id
    LEFT JOIN public.club_member_engagement ce 
      ON ce.user_id = w.user_id 
     AND ce.club_id = e.club_id
    WHERE w.event_id = OLD.event_id
    ORDER BY
        (
            (EXTRACT(EPOCH FROM (NOW() - w.created_at)) / 3600)
            + CASE WHEN COALESCE(ce.is_active_member, FALSE) THEN 50 ELSE 0 END
            + (COALESCE(ce.attendance_streak_weeks, 0) * 5)
            + CASE WHEN COALESCE(ce.is_graduating_senior, FALSE) THEN 20 ELSE 0 END
        ) DESC,
        -- Deterministic tie breaker
        w.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- If a waitlisted student exists, promote them to active RSVP and remove from waitlist
    IF FOUND THEN
        INSERT INTO public.event_rsvps (event_id, user_id, checked_in)
        VALUES (next_waitlist_record.event_id, next_waitlist_record.user_id, false)
        ON CONFLICT (event_id, user_id) DO NOTHING;

        DELETE FROM public.event_waitlist
        WHERE id = next_waitlist_record.id;
    END IF;

    RETURN OLD;
END;
$$;


-- 3. Create get_waitlist_score RPC for the frontend
CREATE OR REPLACE FUNCTION public.get_waitlist_score(
    p_event_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    waitlist_hours NUMERIC,
    time_score NUMERIC,
    membership_score INTEGER,
    streak_score INTEGER,
    senior_score INTEGER,
    total_score NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        ROUND((EXTRACT(EPOCH FROM (NOW() - w.created_at)) / 3600)::numeric, 1) AS waitlist_hours,
        ROUND((EXTRACT(EPOCH FROM (NOW() - w.created_at)) / 3600)::numeric, 1) AS time_score,
        CASE
            WHEN COALESCE(ce.is_active_member, FALSE)
            THEN 50 ELSE 0
        END AS membership_score,
        COALESCE(ce.attendance_streak_weeks, 0) * 5 AS streak_score,
        CASE
            WHEN COALESCE(ce.is_graduating_senior, FALSE)
            THEN 20 ELSE 0
        END AS senior_score,
        ROUND((
            (EXTRACT(EPOCH FROM (NOW() - w.created_at)) / 3600)
            + CASE WHEN COALESCE(ce.is_active_member, FALSE) THEN 50 ELSE 0 END
            + COALESCE(ce.attendance_streak_weeks, 0) * 5
            + CASE WHEN COALESCE(ce.is_graduating_senior, FALSE) THEN 20 ELSE 0 END
        )::numeric, 1) AS total_score
    FROM public.event_waitlist w
    JOIN public.events e ON e.id = w.event_id
    LEFT JOIN public.club_member_engagement ce
      ON ce.user_id = w.user_id
     AND ce.club_id = e.club_id
    WHERE w.event_id = p_event_id
      AND w.user_id = p_user_id;
$$;


-- 4. Create a function to periodically refresh the engagement cache
-- In production, this would be invoked by pg_cron or a Supabase Edge Function
CREATE OR REPLACE FUNCTION public.refresh_club_member_engagement()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Upsert basic membership info from club_members
    INSERT INTO public.club_member_engagement (user_id, club_id, is_active_member, attendance_streak_weeks, is_graduating_senior, updated_at)
    SELECT 
        user_id, 
        club_id, 
        (status = 'approved') AS is_active_member,
        0 AS attendance_streak_weeks, -- Placeholder for Issue #2749 logic
        FALSE AS is_graduating_senior, -- Placeholder for future logic
        NOW() AS updated_at
    FROM public.club_members
    ON CONFLICT (user_id, club_id) DO UPDATE SET
        is_active_member = EXCLUDED.is_active_member,
        updated_at = EXCLUDED.updated_at;
        
    -- NOTE: attendance_streak_weeks and is_graduating_senior can be updated via their respective subsystem queries.
END;
$$;
