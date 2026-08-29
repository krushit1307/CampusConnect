-- Migration: 20260902000000_event_feedback_incentive_escalation.sql
-- Description: Schema and RPC functions for Automated Event Feedback Incentive Escalation

CREATE TABLE IF NOT EXISTS public.club_point_pools (
    club_id UUID PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
    total_balance INT NOT NULL DEFAULT 10000 CHECK (total_balance >= 0),
    escrowed_balance INT NOT NULL DEFAULT 0 CHECK (escrowed_balance >= 0),
    available_balance INT GENERATED ALWAYS AS (total_balance - escrowed_balance) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.event_feedback_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'ESCALATED' CHECK (status IN ('NORMAL', 'ESCALATED', 'EXPIRED', 'COMPLETED', 'CANCELLED')),
    completion_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0000,
    total_check_ins INT NOT NULL DEFAULT 0,
    total_responses INT NOT NULL DEFAULT 0,
    base_reward_points INT NOT NULL DEFAULT 50,
    current_reward_points INT NOT NULL DEFAULT 200,
    total_points_deducted INT NOT NULL DEFAULT 0,
    escalated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '4 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_event_escalation UNIQUE(event_id)
);

CREATE TABLE IF NOT EXISTS public.club_point_deduction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    escalation_id UUID REFERENCES public.event_feedback_escalations(id) ON DELETE SET NULL,
    points_deducted INT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.escalation_push_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escalation_id UUID NOT NULL REFERENCES public.event_feedback_escalations(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    reward_points INT NOT NULL DEFAULT 200,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_escalations_event ON public.event_feedback_escalations(event_id);
CREATE INDEX IF NOT EXISTS idx_club_point_deductions_club ON public.club_point_deduction_logs(club_id);
CREATE INDEX IF NOT EXISTS idx_escalation_push_recipient ON public.escalation_push_logs(recipient_user_id);

-- Enable RLS
ALTER TABLE public.club_point_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_feedback_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_point_deduction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_push_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read for active event feedback escalations"
    ON public.event_feedback_escalations FOR SELECT
    USING (true);

CREATE POLICY "Club officers can view point pools"
    ON public.club_point_pools FOR SELECT
    USING (true);

-- Atomic RPC function to execute incentive escalation
CREATE OR REPLACE FUNCTION trigger_feedback_incentive_escalation(
    p_event_id UUID,
    p_club_id UUID,
    p_min_completion_rate NUMERIC DEFAULT 0.15,
    p_escalated_points INT DEFAULT 200,
    p_base_points INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_checkins INT;
    v_responses INT;
    v_rate NUMERIC;
    v_non_respondents INT;
    v_extra_points_needed INT;
    v_available_pool INT;
    v_points_deducted INT;
    v_escalation_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Calculate total checkins and responses
    SELECT COUNT(*) INTO v_checkins
    FROM public.event_attendees
    WHERE event_id = p_event_id AND checked_in = true;

    SELECT COUNT(*) INTO v_responses
    FROM public.event_feedbacks
    WHERE event_id = p_event_id;

    IF v_checkins = 0 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'No check-ins found for event.');
    END IF;

    v_rate := (v_responses::numeric / v_checkins::numeric);

    -- If rate is below threshold, trigger escalation
    IF v_rate < p_min_completion_rate THEN
        v_non_respondents := v_checkins - v_responses;
        v_extra_points_needed := v_non_respondents * (p_escalated_points - p_base_points);

        -- Check club point pool
        SELECT available_balance INTO v_available_pool
        FROM public.club_point_pools
        WHERE club_id = p_club_id;

        IF v_available_pool IS NULL THEN
            INSERT INTO public.club_point_pools (club_id, total_balance, escrowed_balance)
            VALUES (p_club_id, 10000, 0);
            v_available_pool := 10000;
        END IF;

        v_points_deducted := LEAST(v_available_pool, v_extra_points_needed);

        -- Escrow points from club
        UPDATE public.club_point_pools
        SET escrowed_balance = escrowed_balance + v_points_deducted,
            updated_at = now()
        WHERE club_id = p_club_id;

        v_expires_at := now() + interval '4 hours';

        INSERT INTO public.event_feedback_escalations (
            event_id, club_id, status, completion_rate, total_check_ins, total_responses,
            base_reward_points, current_reward_points, total_points_deducted, escalated_at, expires_at
        ) VALUES (
            p_event_id, p_club_id, 'ESCALATED', v_rate, v_checkins, v_responses,
            p_base_points, p_escalated_points, v_points_deducted, now(), v_expires_at
        )
        ON CONFLICT (event_id)
        DO UPDATE SET
            status = 'ESCALATED',
            current_reward_points = p_escalated_points,
            total_points_deducted = public.event_feedback_escalations.total_points_deducted + v_points_deducted,
            expires_at = v_expires_at,
            updated_at = now()
        RETURNING id INTO v_escalation_id;

        -- Record deduction log
        INSERT INTO public.club_point_deduction_logs (club_id, event_id, escalation_id, points_deducted, reason)
        VALUES (p_club_id, p_event_id, v_escalation_id, v_points_deducted, 'Automated 4x Feedback Incentive Escalation');

        RETURN jsonb_build_object(
            'success', true,
            'escalated', true,
            'escalation_id', v_escalation_id,
            'completion_rate', v_rate,
            'points_deducted', v_points_deducted,
            'new_reward_points', p_escalated_points,
            'expires_at', v_expires_at
        );
    ELSE
        RETURN jsonb_build_object(
            'success', true,
            'escalated', false,
            'completion_rate', v_rate,
            'message', 'Completion rate exceeds threshold; no escalation required.'
        );
    END IF;
END;
$$;
