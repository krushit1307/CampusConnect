-- Migration: 20260920000000_interactive_alumni_mentorship_portal.sql
-- Description: Issue #3885 - Build an 'Interactive Alumni Mentorship' Portal

-- 1. Create alumni_mentorship_availability table
CREATE TABLE IF NOT EXISTS public.alumni_mentorship_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL, -- e.g. 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    start_time TEXT NOT NULL,  -- e.g. '18:00'
    end_time TEXT NOT NULL,    -- e.g. '20:00'
    slot_duration_minutes INT NOT NULL DEFAULT 15,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create mentorship_sessions table
CREATE TABLE IF NOT EXISTS public.mentorship_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    mentee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    topic TEXT,
    meeting_link TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'completed' | 'cancelled'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.alumni_mentorship_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Availability viewable by everyone" ON public.alumni_mentorship_availability;
CREATE POLICY "Availability viewable by everyone" ON public.alumni_mentorship_availability FOR SELECT USING (true);

DROP POLICY IF EXISTS "Availability manageable by mentor" ON public.alumni_mentorship_availability;
CREATE POLICY "Availability manageable by mentor" ON public.alumni_mentorship_availability FOR ALL TO authenticated USING (mentor_id = auth.uid());

DROP POLICY IF EXISTS "Sessions readable by participants" ON public.mentorship_sessions;
CREATE POLICY "Sessions readable by participants" ON public.mentorship_sessions FOR SELECT TO authenticated USING (mentor_id = auth.uid() OR mentee_id = auth.uid());

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mentorship_sessions;

-- 3. RPC function to handle 100 points deduction and book session atomically
CREATE OR REPLACE FUNCTION public.book_mentorship_session_transaction(
    p_mentor_id UUID,
    p_mentee_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_topic TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_points_balance INT := 0;
    v_session_id UUID;
    v_meeting_link TEXT;
    v_points_required INT := 100;
BEGIN
    -- Check mentee points balance
    SELECT COALESCE(SUM(amount), 0) INTO v_points_balance
    FROM public.points_ledger
    WHERE user_id = p_mentee_id;

    IF v_points_balance < v_points_required THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient gamification points. 100 points required to book a mentorship chat.',
            'current_points', v_points_balance,
            'required_points', v_points_required
        );
    END IF;

    -- Check if slot is already booked
    IF EXISTS (
        SELECT 1 FROM public.mentorship_sessions
        WHERE mentor_id = p_mentor_id
          AND status = 'scheduled'
          AND start_time < p_end_time
          AND end_time > p_start_time
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This time slot is no longer available. Please select another slot.'
        );
    END IF;

    -- Deduct 100 gamification points
    INSERT INTO public.points_ledger (user_id, amount, reason, created_at)
    VALUES (p_mentee_id, -v_points_required, '15-Min Alumni Mentorship Coffee Chat Booking', NOW());

    -- Generate unique video call link (Jitsi Meet / Google Meet format)
    v_meeting_link := 'https://meet.jit.si/campusconnect-mentorship-' || gen_random_uuid()::text;

    -- Insert mentorship session
    INSERT INTO public.mentorship_sessions (
        mentor_id,
        mentee_id,
        start_time,
        end_time,
        topic,
        meeting_link,
        status,
        created_at
    ) VALUES (
        p_mentor_id,
        p_mentee_id,
        p_start_time,
        p_end_time,
        p_topic,
        v_meeting_link,
        'scheduled',
        NOW()
    ) RETURNING id INTO v_session_id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session_id,
        'mentor_id', p_mentor_id,
        'mentee_id', p_mentee_id,
        'start_time', p_start_time,
        'end_time', p_end_time,
        'meeting_link', v_meeting_link,
        'points_deducted', v_points_required,
        'remaining_points', v_points_balance - v_points_required
    );
END;
$$;
