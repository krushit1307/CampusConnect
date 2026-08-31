-- =============================================================================
-- Migration: Automated Conflict of Interest Detection for Elections
-- Issue: #3601 - Implement 'Automated "Conflict of Interest" Detection' for Elections
-- Description:
--   Automatically flags and blocks candidates running for executive positions
--   in an election if they already hold an Executive role in a conflicting/competing
--   club category. Inserts audit/alert logs for Student Union review.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Competing Categories Mapping
-- Maps conflicting category pairs (e.g. Political Party A vs Political Party B)
CREATE TABLE IF NOT EXISTS public.competing_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.club_categories(id) ON DELETE CASCADE,
    competing_category_id UUID NOT NULL REFERENCES public.club_categories(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_competing_pair UNIQUE (category_id, competing_category_id),
    CONSTRAINT check_not_self_competing CHECK (category_id <> competing_category_id)
);

CREATE INDEX IF NOT EXISTS idx_competing_categories_cat ON public.competing_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_competing_categories_comp ON public.competing_categories(competing_category_id);

-- 2. Conflict of Interest Alerts Table (for Student Union audit and manual review)
CREATE TABLE IF NOT EXISTS public.election_coi_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID REFERENCES public.club_elections(id) ON DELETE SET NULL,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    candidate_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    candidate_name TEXT NOT NULL,
    target_position TEXT NOT NULL,
    conflicting_club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
    conflicting_club_name TEXT NOT NULL,
    conflicting_role_title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'flagged' CHECK (status IN ('flagged', 'reviewed', 'exception_granted', 'dismissed')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_election_coi_alerts_club ON public.election_coi_alerts(club_id);
CREATE INDEX IF NOT EXISTS idx_election_coi_alerts_candidate ON public.election_coi_alerts(candidate_user_id);

-- 3. Verification RPC: Check Candidate Conflict of Interest
CREATE OR REPLACE FUNCTION public.verify_candidate_conflict_of_interest(
    p_club_id UUID,
    p_candidate_user_id UUID,
    p_position TEXT DEFAULT 'Executive'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_club_name TEXT;
    v_target_category_id UUID;
    v_conflicting_record RECORD;
    v_has_conflict BOOLEAN := FALSE;
    v_result JSONB;
BEGIN
    -- Get target club details
    SELECT name, category_id INTO v_target_club_name, v_target_category_id
    FROM public.clubs
    WHERE id = p_club_id;

    IF v_target_club_name IS NULL THEN
        RAISE EXCEPTION 'Target club not found.';
    END IF;

    -- Look for conflicting executive roles held by candidate
    -- An executive role has permissions_level >= 50 or title in ('President', 'Vice President', 'Treasurer', 'Secretary', 'Executive')
    SELECT 
        c.id AS conflicting_club_id,
        c.name AS conflicting_club_name,
        cr.title AS conflicting_role_title
    INTO v_conflicting_record
    FROM public.club_members cm
    JOIN public.clubs c ON c.id = cm.club_id
    JOIN public.club_roles cr ON cr.id = cm.role_id
    WHERE cm.user_id = p_candidate_user_id
      AND cm.status = 'approved'
      AND c.id <> p_club_id
      AND (
          cr.permissions_level >= 50 
          OR LOWER(cr.title) IN ('president', 'vice president', 'treasurer', 'secretary', 'executive')
      )
      AND (
          -- Same category conflict (competing within same category)
          (v_target_category_id IS NOT NULL AND c.category_id = v_target_category_id)
          OR
          -- Explicit competing category mapping
          EXISTS (
              SELECT 1 FROM public.competing_categories cc
              WHERE (cc.category_id = v_target_category_id AND cc.competing_category_id = c.category_id)
                 OR (cc.category_id = c.category_id AND cc.competing_category_id = v_target_category_id)
          )
      )
    LIMIT 1;

    IF v_conflicting_record.conflicting_club_name IS NOT NULL THEN
        v_has_conflict := TRUE;

        -- Log alert for Student Union review
        INSERT INTO public.election_coi_alerts (
            club_id,
            candidate_user_id,
            candidate_name,
            target_position,
            conflicting_club_id,
            conflicting_club_name,
            conflicting_role_title
        ) VALUES (
            p_club_id,
            p_candidate_user_id,
            COALESCE((SELECT full_name FROM public.profiles WHERE id = p_candidate_user_id), 'Candidate'),
            p_position,
            v_conflicting_record.conflicting_club_id,
            v_conflicting_record.conflicting_club_name,
            v_conflicting_record.conflicting_role_title
        );

        v_result := jsonb_build_object(
            'has_conflict', TRUE,
            'conflicting_club', v_conflicting_record.conflicting_club_name,
            'conflicting_role', v_conflicting_record.conflicting_role_title,
            'message', 'You cannot run for this position while holding an executive role in ' || v_conflicting_record.conflicting_club_name || '.'
        );
    ELSE
        v_result := jsonb_build_object(
            'has_conflict', FALSE,
            'message', 'No conflict of interest detected.'
        );
    END IF;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_candidate_conflict_of_interest(UUID, UUID, TEXT) TO authenticated, service_role;

-- 4. Enable RLS
ALTER TABLE public.competing_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.election_coi_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view competing categories"
ON public.competing_categories FOR SELECT USING (true);

CREATE POLICY "Student Union and admins can view COI alerts"
ON public.election_coi_alerts FOR SELECT
USING (auth.uid() = candidate_user_id OR public.is_system_admin());
