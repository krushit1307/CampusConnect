-- =============================================================================
-- Migration: Automated Dorm vs Commuter Demographic Tagging
-- Issue: #3324 - Implement 'Automated Dorm vs Commuter Demographic Tagging'
-- Description: Adds commuter status to user profiles and accessibility tags 
-- to events. Includes an RPC to calculate the commuter percentage for a club.
-- =============================================================================

-- 1. Add is_commuter to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_commuter BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.is_commuter IS 'True if the student commutes and relies on public transit schedules.';

-- 2. Add accessibility_tags to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS accessibility_tags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.events.accessibility_tags IS 'Array of tags like commuter-friendly, dorm-only, wheelchair-accessible.';

-- 3. RPC: Get Club Commuter Percentage
CREATE OR REPLACE FUNCTION public.get_club_commuter_percentage(p_club_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_total_members INT;
    v_commuter_members INT;
    v_percentage NUMERIC;
BEGIN
    SELECT COUNT(*) INTO v_total_members
    FROM public.club_members cm
    JOIN public.profiles p ON cm.user_id = p.id
    WHERE cm.club_id = p_club_id AND cm.status = 'approved';

    IF v_total_members = 0 THEN RETURN 0; END IF;

    SELECT COUNT(*) INTO v_commuter_members
    FROM public.club_members cm
    JOIN public.profiles p ON cm.user_id = p.id
    WHERE cm.club_id = p_club_id AND cm.status = 'approved' AND p.is_commuter = TRUE;

    v_percentage := (v_commuter_members::NUMERIC / v_total_members::NUMERIC) * 100;
    RETURN ROUND(v_percentage, 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
