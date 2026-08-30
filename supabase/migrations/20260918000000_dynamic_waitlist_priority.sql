-- Migration: 20260918000000_dynamic_waitlist_priority.sql
-- Description: Issue #3874 - Develop a 'Dynamic Waitlist Priority' Algorithm

-- 1. Add priority_score column to public.event_waitlist
ALTER TABLE public.event_waitlist
ADD COLUMN IF NOT EXISTS priority_score NUMERIC DEFAULT 0;

-- 2. Add gamification_points, attendance_count, and no_show_count to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gamification_points INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS attendance_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS no_show_count INT DEFAULT 0;

-- 3. Function to calculate weighted priority score for a user
CREATE OR REPLACE FUNCTION public.calculate_user_waitlist_priority_score(
    p_user_id UUID,
    p_waitlist_created_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gamification_pts INT := 0;
    v_attendance INT := 0;
    v_no_shows INT := 0;
    v_base_time_score NUMERIC := 0;
    v_gamification_bonus NUMERIC := 0;
    v_attendance_bonus NUMERIC := 0;
    v_no_show_penalty NUMERIC := 0;
    v_final_score NUMERIC := 0;
BEGIN
    -- Query user profile metrics
    SELECT COALESCE(gamification_points, 0), COALESCE(attendance_count, 0), COALESCE(no_show_count, 0)
    INTO v_gamification_pts, v_attendance, v_no_shows
    FROM public.profiles
    WHERE id = p_user_id;

    -- Base Timestamp score decay: earlier joiners get up to 100 base points (decays slowly)
    v_base_time_score := GREATEST(0.0, 100.0 - (EXTRACT(EPOCH FROM (NOW() - p_waitlist_created_at)) / 3600.0 * 0.5));

    -- Gamification bonus: 2.5 pts per XP point
    v_gamification_bonus := v_gamification_pts * 2.5;

    -- Attendance streak bonus: 10 pts per event attended
    v_attendance_bonus := v_attendance * 10.0;

    -- No-Show penalty: -25 pts per no-show/flake
    v_no_show_penalty := v_no_shows * 25.0;

    v_final_score := v_base_time_score + v_gamification_bonus + v_attendance_bonus - v_no_show_penalty;

    RETURN ROUND(v_final_score, 2);
END;
$$;

-- 4. Update promote_waitlist_attendee function to rank by priority_score DESC
CREATE OR REPLACE FUNCTION public.promote_waitlist_attendee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_waitlist_record RECORD;
BEGIN
    -- Update priority_scores for all waitlisted users for this event
    UPDATE public.event_waitlist w
    SET priority_score = public.calculate_user_waitlist_priority_score(w.user_id, w.created_at)
    WHERE w.event_id = OLD.event_id;

    -- Query waitlist user with HIGHEST priority_score
    SELECT id, event_id, user_id INTO next_waitlist_record
    FROM public.event_waitlist
    WHERE event_id = OLD.event_id
    ORDER BY priority_score DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
        INSERT INTO public.event_rsvps (event_id, user_id, status)
        VALUES (next_waitlist_record.event_id, next_waitlist_record.user_id, 'attending')
        ON CONFLICT (event_id, user_id) DO NOTHING;

        DELETE FROM public.event_waitlist
        WHERE id = next_waitlist_record.id;
    END IF;

    RETURN OLD;
END;
$$;

-- 5. RPC function to explicitly promote top priority waitlist user
CREATE OR REPLACE FUNCTION public.promote_top_dynamic_waitlist_user(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    top_record RECORD;
    v_user_name TEXT;
BEGIN
    -- Recalculate priority scores for event waitlist
    UPDATE public.event_waitlist w
    SET priority_score = public.calculate_user_waitlist_priority_score(w.user_id, w.created_at)
    WHERE w.event_id = p_event_id;

    -- Fetch top priority waitlisted user
    SELECT w.id, w.event_id, w.user_id, w.priority_score, p.full_name
    INTO top_record
    FROM public.event_waitlist w
    JOIN public.profiles p ON p.id = w.user_id
    WHERE w.event_id = p_event_id
    ORDER BY w.priority_score DESC, w.created_at ASC
    LIMIT 1;

    IF top_record.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Waitlist is empty');
    END IF;

    -- Promote to event_rsvps
    INSERT INTO public.event_rsvps (event_id, user_id, status)
    VALUES (top_record.event_id, top_record.user_id, 'attending')
    ON CONFLICT (event_id, user_id) DO NOTHING;

    -- Remove from waitlist
    DELETE FROM public.event_waitlist WHERE id = top_record.id;

    RETURN jsonb_build_object(
        'success', true,
        'promoted_user_id', top_record.user_id,
        'user_full_name', top_record.full_name,
        'priority_score', top_record.priority_score
    );
END;
$$;
