-- =============================================================================
-- Migration: Dynamic Club Leaderboard Probation Penalty
-- Issue: #4533 - Develop a 'Dynamic "Club Leaderboard" Probation Penalty'
-- Description: Couples disciplinary probation status to the gamification economy.
-- Intercepts point allocation, blocks points for clubs on active probation,
-- and provides retroactive points deduction for violation events.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. Ensure club_probations table exists with all required fields
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.club_probations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'expunged', 'appeal_pending')),
    points_frozen BOOLEAN NOT NULL DEFAULT TRUE,
    retroactive_points_deducted INT NOT NULL DEFAULT 0,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_probations_club_status 
ON public.club_probations(club_id, status);

CREATE INDEX IF NOT EXISTS idx_club_probations_event 
ON public.club_probations(event_id);

-- =============================================================================
-- 2. Helper Function: Is Club On Active Probation
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_club_on_probation(p_club_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_probation BOOLEAN := FALSE;
BEGIN
    IF p_club_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check active record in club_probations
    SELECT EXISTS (
        SELECT 1 FROM public.club_probations
        WHERE club_id = p_club_id
          AND status = 'active'
          AND expires_at > NOW()
    ) INTO v_is_probation;

    IF v_is_probation THEN
        RETURN TRUE;
    END IF;

    -- Also check clubs status enum / column
    SELECT EXISTS (
        SELECT 1 FROM public.clubs
        WHERE id = p_club_id
          AND status = 'probation'
    ) INTO v_is_probation;

    RETURN v_is_probation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. Intercept & Award Points with Probation Guard
-- =============================================================================
CREATE OR REPLACE FUNCTION public.award_points(
    p_user_id UUID,
    p_event_id UUID,
    p_base_points INT,
    p_club_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_club_id UUID := p_club_id;
    v_is_probation BOOLEAN := FALSE;
    v_event_name TEXT;
    v_series_id UUID;
    v_multiplier NUMERIC := 1.0;
    v_consecutive_count INT := 1;
    v_final_points INT := p_base_points;
    v_streak_msg TEXT;
BEGIN
    -- 1. Look up event details and club_id if not provided
    SELECT club_id, name, event_series_id 
    INTO v_club_id, v_event_name, v_series_id
    FROM public.events
    WHERE id = p_event_id;

    IF v_club_id IS NULL AND p_club_id IS NOT NULL THEN
        v_club_id := p_club_id;
    END IF;

    -- 2. Intercept: Check if the club is currently on active probation
    IF v_club_id IS NOT NULL THEN
        v_is_probation := public.is_club_on_probation(v_club_id);
    END IF;

    -- 3. If club is on probation, COMPLETELY BLOCK point allocation
    IF v_is_probation THEN
        -- Log the blocked point allocation in ledger for auditing
        INSERT INTO public.ledger_transactions (
            user_id,
            event_id,
            club_id,
            amount,
            transaction_type,
            base_points,
            streak_multiplier,
            is_streak_bonus,
            description,
            created_at
        ) VALUES (
            p_user_id,
            p_event_id,
            v_club_id,
            0,
            'probation_blocked',
            p_base_points,
            0,
            FALSE,
            'Point accumulation is FROZEN due to active Disciplinary Probation for club ' || v_club_id,
            NOW()
        );

        RETURN jsonb_build_object(
            'success', false,
            'frozen', true,
            'points_awarded', 0,
            'club_id', v_club_id,
            'message', 'Point Accumulation is FROZEN due to active Disciplinary Probation.'
        );
    END IF;

    -- 4. Calculate streak multiplier if series event
    IF v_series_id IS NOT NULL THEN
        SELECT current_streak INTO v_consecutive_count
        FROM public.user_series_streaks
        WHERE user_id = p_user_id AND event_series_id = v_series_id;

        IF FOUND THEN
            v_consecutive_count := v_consecutive_count + 1;
            v_multiplier := POWER(1.5, v_consecutive_count);

            UPDATE public.user_series_streaks
            SET current_streak = v_consecutive_count,
                max_streak = GREATEST(max_streak, v_consecutive_count),
                last_attended_event_id = p_event_id,
                last_attended_at = NOW()
            WHERE user_id = p_user_id AND event_series_id = v_series_id;
        ELSE
            v_consecutive_count := 1;
            v_multiplier := 1.0;

            INSERT INTO public.user_series_streaks (user_id, event_series_id, current_streak, max_streak, last_attended_event_id)
            VALUES (p_user_id, v_series_id, 1, 1, p_event_id);
        END IF;

        v_final_points := ROUND(p_base_points * v_multiplier);
        v_streak_msg := '🔥 ' || v_consecutive_count || '-Event Streak! ' || v_final_points || ' Points Awarded!';
    ELSE
        v_final_points := p_base_points;
        v_streak_msg := '+' || p_base_points || ' Points Awarded!';
    END IF;

    -- 5. Record the gamification reward
    INSERT INTO public.ledger_transactions (
        user_id,
        event_id,
        club_id,
        amount,
        transaction_type,
        base_points,
        streak_multiplier,
        is_streak_bonus,
        description,
        created_at
    ) VALUES (
        p_user_id,
        p_event_id,
        v_club_id,
        v_final_points,
        'gamification_reward',
        p_base_points,
        v_multiplier,
        (v_consecutive_count > 1),
        v_streak_msg,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'frozen', false,
        'points_awarded', v_final_points,
        'streak_count', v_consecutive_count,
        'multiplier', v_multiplier,
        'streak_message', v_streak_msg
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. Retroactively Deduct Probation Event Points
-- =============================================================================
CREATE OR REPLACE FUNCTION public.retroactively_deduct_probation_event_points(
    p_club_id UUID,
    p_event_id UUID,
    p_reason TEXT DEFAULT 'Retroactive point deduction for unauthorized event on probation'
) RETURNS JSONB AS $$
DECLARE
    v_total_points_to_deduct INT := 0;
    v_deduction_count INT := 0;
BEGIN
    -- 1. Calculate total points earned by attendees/club for this event
    SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO v_total_points_to_deduct, v_deduction_count
    FROM public.ledger_transactions
    WHERE event_id = p_event_id
      AND amount > 0
      AND transaction_type IN ('gamification_reward', 'event_points', 'checkin');

    IF v_total_points_to_deduct <= 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'deducted_points', 0,
            'message', 'No positive points found to deduct for this event.'
        );
    END IF;

    -- 2. Insert inverse deduction transaction in ledger
    INSERT INTO public.ledger_transactions (
        club_id,
        event_id,
        amount,
        transaction_type,
        base_points,
        streak_multiplier,
        is_streak_bonus,
        description,
        created_at
    ) VALUES (
        p_club_id,
        p_event_id,
        -v_total_points_to_deduct,
        'probation_penalty',
        -v_total_points_to_deduct,
        1.0,
        FALSE,
        p_reason || ' (Revoked ' || v_total_points_to_deduct || ' points)',
        NOW()
    );

    -- 3. Update club_probations record
    UPDATE public.club_probations
    SET retroactive_points_deducted = retroactive_points_deducted + v_total_points_to_deduct,
        updated_at = NOW()
    WHERE club_id = p_club_id
      AND (event_id = p_event_id OR event_id IS NULL)
      AND status = 'active';

    RETURN jsonb_build_object(
        'success', true,
        'club_id', p_club_id,
        'event_id', p_event_id,
        'deducted_points', v_total_points_to_deduct,
        'message', 'Successfully retroactively deducted ' || v_total_points_to_deduct || ' points.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
