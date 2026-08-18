-- Migration: 20261021000000_gamified_streak_system.sql
-- Description: Implement gamified attendance streak system, including profiles columns, academic calendar integration, and cron jobs.

-- 1. Alter profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_attended_week DATE;

-- 2. Helper function to find last active (non-holiday) week
CREATE OR REPLACE FUNCTION public.get_last_active_week(p_ref_date DATE)
RETURNS DATE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_check_week DATE;
    v_is_holiday BOOLEAN;
    v_safety_counter INTEGER := 0;
BEGIN
    v_check_week := DATE_TRUNC('week', p_ref_date)::DATE;
    
    LOOP
        v_safety_counter := v_safety_counter + 1;
        -- Safety cap at 52 weeks (1 year lookback) to prevent infinite loops
        IF v_safety_counter > 52 THEN
            RETURN v_check_week;
        END IF;

        SELECT EXISTS (
            SELECT 1 
            FROM public.academic_calendar_periods 
            WHERE period_type IN ('HOLIDAY', 'CLOSURE')
              AND start_date <= (v_check_week + INTERVAL '6 days')::DATE
              AND end_date >= v_check_week
        ) INTO v_is_holiday;
        
        IF NOT v_is_holiday THEN
            RETURN v_check_week;
        END IF;
        
        v_check_week := (v_check_week - INTERVAL '1 week')::DATE;
    END LOOP;
END;
$$;

-- 3. Trigger function to handle streak on event check-in
CREATE OR REPLACE FUNCTION public.handle_streak_on_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
    v_actual_week DATE;
    v_last_active_week DATE;
    v_new_streak INTEGER;
    v_points_earned INTEGER;
    v_streak_desc TEXT;
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Get user profile details
    SELECT current_streak, last_attended_week INTO v_profile
    FROM public.profiles
    WHERE id = NEW.user_id;

    v_actual_week := DATE_TRUNC('week', NOW())::DATE;

    -- If already checked in this week, do nothing
    IF v_profile.last_attended_week = v_actual_week THEN
        RETURN NEW;
    END IF;

    -- Find the last active week before the current actual week
    v_last_active_week := public.get_last_active_week((v_actual_week - INTERVAL '1 day')::DATE);

    IF v_profile.last_attended_week IS NULL THEN
        v_new_streak := 1;
    ELSIF v_profile.last_attended_week >= v_last_active_week THEN
        v_new_streak := v_profile.current_streak + 1;
    ELSE
        v_new_streak := 1;
    END IF;

    -- Update user profile
    UPDATE public.profiles
    SET current_streak = v_new_streak,
        last_attended_week = v_actual_week
    WHERE id = NEW.user_id;

    -- Calculate check-in points
    -- Base: 50 points. Multiplier bonuses for milestones:
    -- Streak >= 10: 150 points (3x multiplier)
    -- Streak >= 5: 100 points (2x multiplier)
    -- Otherwise: 50 points (1x multiplier)
    IF v_new_streak >= 10 THEN
        v_points_earned := 150;
        v_streak_desc := '10+ Weeks Milestone (3x Multiplier)';
    ELSIF v_new_streak >= 5 THEN
        v_points_earned := 100;
        v_streak_desc := '5+ Weeks Milestone (2x Multiplier)';
    ELSE
        v_points_earned := 50;
        v_streak_desc := 'Standard check-in (1x Multiplier)';
    END IF;

    -- Lock and update wallet balance in public.user_wallets
    SELECT balance INTO v_current_balance
    FROM public.user_wallets
    WHERE user_id = NEW.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        v_current_balance := 0;
        INSERT INTO public.user_wallets (user_id, balance, lifetime_earned, updated_at)
        VALUES (NEW.user_id, v_points_earned, v_points_earned, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET balance = public.user_wallets.balance + EXCLUDED.balance,
            lifetime_earned = public.user_wallets.lifetime_earned + EXCLUDED.lifetime_earned,
            updated_at = NOW()
        RETURNING balance INTO v_new_balance;
    ELSE
        v_new_balance := v_current_balance + v_points_earned;
        UPDATE public.user_wallets
        SET balance = v_new_balance,
            lifetime_earned = lifetime_earned + v_points_earned,
            updated_at = NOW()
        WHERE user_id = NEW.user_id;
    END IF;

    -- Record transaction in the immutable ledger table public.wallet_transactions
    INSERT INTO public.wallet_transactions (user_id, amount, balance_after, transaction_type, description, reference_id)
    VALUES (
        NEW.user_id,
        v_points_earned,
        v_new_balance,
        'earn',
        'Attendance streak ' || v_new_streak || ' weeks: ' || v_streak_desc,
        NEW.event_id
    );

    RETURN NEW;
END;
$$;

-- 4. Create trigger on public.event_rsvps
DROP TRIGGER IF EXISTS trg_handle_streak_on_checkin ON public.event_rsvps;
CREATE TRIGGER trg_handle_streak_on_checkin
AFTER INSERT OR UPDATE ON public.event_rsvps
FOR EACH ROW
WHEN (NEW.checked_in = TRUE AND (TG_OP = 'INSERT' OR OLD.checked_in IS DISTINCT FROM TRUE))
EXECUTE FUNCTION public.handle_streak_on_checkin();

-- 5. Cron Job evaluator function
CREATE OR REPLACE FUNCTION public.evaluate_user_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actual_week DATE;
    v_is_holiday BOOLEAN;
BEGIN
    v_actual_week := DATE_TRUNC('week', NOW())::DATE;

    -- Check if the current week is a holiday week
    SELECT EXISTS (
        SELECT 1 
        FROM public.academic_calendar_periods 
        WHERE period_type IN ('HOLIDAY', 'CLOSURE')
          AND start_date <= (v_actual_week + INTERVAL '6 days')::DATE
          AND end_date >= v_actual_week
    ) INTO v_is_holiday;

    -- If the current week has a holiday/closure, freeze streaks (do nothing)
    IF v_is_holiday THEN
        RETURN;
    END IF;

    -- Reset streaks for users who did not attend this week
    UPDATE public.profiles
    SET current_streak = 0
    WHERE last_attended_week IS DISTINCT FROM v_actual_week
       OR last_attended_week IS NULL;
END;
$$;

-- 6. Schedule cron job running every Sunday at 11:59 PM (minute 59, hour 23, day of week 0 = Sunday)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        PERFORM extensions.cron.schedule('evaluate-user-streaks', '59 23 * * 0', 'SELECT public.evaluate_user_streaks();');
    END IF;
END $$;
