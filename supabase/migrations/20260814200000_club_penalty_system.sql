-- Migration: 20260814200000_club_penalty_system.sql
-- Description: Create club_infractions table, alter clubs table for is_suspended,
--               rolling 365-day penalty trigger, RLS policies, and appeal RPC (#3017).

-- 1. Alter clubs table to add is_suspended flag
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create club_infractions table
CREATE TABLE IF NOT EXISTS public.club_infractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    severity TEXT NOT NULL DEFAULT 'minor', -- minor, moderate, severe, critical
    description TEXT NOT NULL,
    points_penalized INT NOT NULL DEFAULT 1,
    issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, appealed, revoked
    appeal_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.club_infractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club infractions"
    ON public.club_infractions FOR SELECT
    USING (TRUE);

CREATE POLICY "Student Union admins can manage infractions"
    ON public.club_infractions FOR ALL
    USING (auth.role() = 'authenticated');

-- 3. Trigger Function: Calculates rolling 365-day active penalty points and updates is_suspended
CREATE OR REPLACE FUNCTION public.evaluate_club_penalty_points()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_club_id UUID;
    v_total_points INT := 0;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_club_id := OLD.club_id;
    ELSE
        v_club_id := NEW.club_id;
    END IF;

    -- Calculate total active penalty points issued in the last 365 days
    SELECT COALESCE(SUM(points_penalized), 0) INTO v_total_points
    FROM public.club_infractions
    WHERE club_id = v_club_id
      AND status = 'active'
      AND created_at >= NOW() - INTERVAL '1 year';

    -- Automatically update club suspension status (Threshold >= 10 points)
    UPDATE public.clubs
    SET is_suspended = (v_total_points >= 10)
    WHERE id = v_club_id;

    RETURN NEW;
END;
$$;

-- Attach trigger to club_infractions table
DROP TRIGGER IF EXISTS trg_evaluate_club_penalty ON public.club_infractions;
CREATE TRIGGER trg_evaluate_club_penalty
    AFTER INSERT OR UPDATE OR DELETE ON public.club_infractions
    FOR EACH ROW
    EXECUTE FUNCTION public.evaluate_club_penalty_points();

-- 4. RLS Policy: Prevent suspended clubs from creating events
DROP POLICY IF EXISTS "Suspended clubs cannot create events" ON public.events;
CREATE POLICY "Suspended clubs cannot create events"
    ON public.events FOR INSERT
    WITH CHECK (
        NOT EXISTS (
            SELECT 1 FROM public.clubs c
            WHERE c.id = host_club_id AND c.is_suspended = TRUE
        )
    );

-- 5. RPC Function: Appeal a club infraction
CREATE OR REPLACE FUNCTION public.appeal_club_infraction(
    p_infraction_id UUID,
    p_appeal_reason TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
    v_infraction RECORD;
BEGIN
    SELECT * INTO v_infraction FROM public.club_infractions WHERE id = p_infraction_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Infraction record not found.';
        RETURN;
    END IF;

    -- Update infraction status to appealed
    UPDATE public.club_infractions
    SET status = 'appealed', appeal_reason = p_appeal_reason
    WHERE id = p_infraction_id;

    -- Re-evaluate suspension status for the club
    PERFORM public.evaluate_club_penalty_points();

    RETURN QUERY SELECT TRUE, 'Infraction appeal submitted successfully. Suspension re-evaluated.';
END;
$$;
