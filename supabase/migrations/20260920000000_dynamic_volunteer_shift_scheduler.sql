-- Migration: 20260920000000_dynamic_volunteer_shift_scheduler.sql
-- Description: Issue #3892 - Develop a 'Dynamic Volunteer Shift' Scheduler

-- 1. Create volunteer_shifts table
CREATE TABLE IF NOT EXISTS public.volunteer_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    role_name TEXT NOT NULL, -- e.g. 'Registration Desk', 'Tech Support', 'Logistics'
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    points_per_hour INT NOT NULL DEFAULT 50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create shift_claims table
CREATE TABLE IF NOT EXISTS public.shift_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES public.volunteer_shifts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'claimed', -- 'claimed' | 'completed' | 'cancelled'
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(shift_id, user_id)
);

-- Enable RLS
ALTER TABLE public.volunteer_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Volunteer shifts viewable by everyone" ON public.volunteer_shifts;
CREATE POLICY "Volunteer shifts viewable by everyone" ON public.volunteer_shifts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Volunteer shifts manageable by authenticated users" ON public.volunteer_shifts;
CREATE POLICY "Volunteer shifts manageable by authenticated users" ON public.volunteer_shifts FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Shift claims viewable by everyone" ON public.shift_claims;
CREATE POLICY "Shift claims viewable by everyone" ON public.shift_claims FOR SELECT USING (true);

DROP POLICY IF EXISTS "Shift claims manageable by owner" ON public.shift_claims;
CREATE POLICY "Shift claims manageable by owner" ON public.shift_claims FOR ALL TO authenticated USING (user_id = auth.uid());

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.volunteer_shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_claims;

-- 3. RPC function to handle shift claim with capacity check, time-collision validation, & gamification points award
CREATE OR REPLACE FUNCTION public.claim_volunteer_shift_transaction(
    p_shift_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shift RECORD;
    v_current_claims INT := 0;
    v_claim_id UUID;
    v_duration_hours NUMERIC(10, 2);
    v_points_awarded INT;
BEGIN
    -- Lock shift row to serialize concurrent claims and prevent overbooking
    SELECT * INTO v_shift FROM public.volunteer_shifts WHERE id = p_shift_id FOR UPDATE;

    IF v_shift.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Volunteer shift not found');
    END IF;

    -- Check if user already claimed this specific shift
    IF EXISTS (
        SELECT 1 FROM public.shift_claims
        WHERE shift_id = p_shift_id AND user_id = p_user_id AND status = 'claimed'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You have already claimed this volunteer shift.');
    END IF;

    -- Count active claims for this shift
    SELECT COUNT(*) INTO v_current_claims
    FROM public.shift_claims
    WHERE shift_id = p_shift_id AND status = 'claimed';

    IF v_current_claims >= v_shift.capacity THEN
        RETURN jsonb_build_object('success', false, 'error', 'Shift is already at full capacity.');
    END IF;

    -- Time-collision validation: Check if user has an overlapping claimed shift
    IF EXISTS (
        SELECT 1
        FROM public.shift_claims sc
        JOIN public.volunteer_shifts vs ON vs.id = sc.shift_id
        WHERE sc.user_id = p_user_id
          AND sc.status = 'claimed'
          AND vs.start_time < v_shift.end_time
          AND vs.end_time > v_shift.start_time
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Time collision: You already have a claimed volunteer shift overlapping with this time slot.'
        );
    END IF;

    -- Calculate shift duration and gamification points
    v_duration_hours := ROUND(EXTRACT(EPOCH FROM (v_shift.end_time - v_shift.start_time))::NUMERIC / 3600.0, 2);
    IF v_duration_hours <= 0 THEN
        v_duration_hours := 1.0;
    END IF;

    v_points_awarded := GREATEST(10, ROUND(v_duration_hours * v_shift.points_per_hour));

    -- Insert shift claim
    INSERT INTO public.shift_claims (
        shift_id,
        user_id,
        status,
        claimed_at
    ) VALUES (
        p_shift_id,
        p_user_id,
        'claimed',
        NOW()
    ) RETURNING id INTO v_claim_id;

    -- Award Gamification Points in points_ledger
    INSERT INTO public.points_ledger (
        user_id,
        amount,
        reason,
        created_at
    ) VALUES (
        p_user_id,
        v_points_awarded,
        'Claimed Volunteer Shift: ' || v_shift.role_name || ' (' || v_duration_hours || ' hrs)',
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'claim_id', v_claim_id,
        'shift_id', p_shift_id,
        'user_id', p_user_id,
        'role_name', v_shift.role_name,
        'duration_hours', v_duration_hours,
        'points_awarded', v_points_awarded
    );
END;
$$;
