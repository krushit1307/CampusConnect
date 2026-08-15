-- =============================================================================
-- Migration: Event Series Dependencies (Prerequisites)
-- Issue: #3224 - Implement 'Event Series Dependencies' (Prerequisites)
-- Description: Adds a prerequisite rule engine to the events table. Allows 
-- organizers to require verified physical attendance at previous events 
-- before a user can RSVP to a subsequent event in a series.
-- =============================================================================

-- 1. Add prerequisite columns to the events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS prerequisite_event_ids UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS allow_conditional_rsvp BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.events.prerequisite_event_ids IS 'Array of event IDs that the user must have ATTENDED (not just RSVPd) to access this event.';
COMMENT ON COLUMN public.events.allow_conditional_rsvp IS 'If true, users can RSVP before the prerequisite event occurs, but their ticket is revoked if they fail to attend the prerequisite.';

-- 2. Table to track manual prerequisite overrides by organizers
CREATE TABLE IF NOT EXISTS public.prerequisite_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    overridden_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prereq_overrides_event ON public.prerequisite_overrides(event_id);

-- =============================================================================
-- RPC: Check Event Prerequisites
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_event_prerequisites(
    p_user_id UUID,
    p_event_id UUID
) RETURNS TABLE (
    is_eligible BOOLEAN,
    missing_prerequisites TEXT[],
    has_override BOOLEAN
) AS $$
DECLARE
    v_prereqs UUID[];
    v_missing UUID[];
    v_missing_titles TEXT[];
    v_has_override BOOLEAN;
BEGIN
    -- 1. Fetch prerequisites for the target event
    SELECT prerequisite_event_ids INTO v_prereqs 
    FROM public.events WHERE id = p_event_id;

    -- If no prerequisites, user is eligible
    IF v_prereqs IS NULL OR array_length(v_prereqs, 1) IS NULL THEN
        RETURN QUERY SELECT TRUE, '{}'::TEXT[], FALSE;
        RETURN;
    END IF;

    -- 2. Check for manual override
    SELECT EXISTS (
        SELECT 1 FROM public.prerequisite_overrides 
        WHERE event_id = p_event_id AND user_id = p_user_id
    ) INTO v_has_override;

    IF v_has_override THEN
        RETURN QUERY SELECT TRUE, '{}'::TEXT[], TRUE;
        RETURN;
    END IF;

    -- 3. Find which prerequisites the user has NOT attended
    -- We check the event_rsvps table for checked_in = TRUE
    SELECT ARRAY(
        SELECT unnest(v_prereqs)
        EXCEPT
        SELECT er.event_id 
        FROM public.event_rsvps er 
        WHERE er.user_id = p_user_id AND er.checked_in = TRUE
    ) INTO v_missing;

    IF array_length(v_missing, 1) IS NULL OR v_missing IS NULL THEN
        -- User has attended all prerequisites
        RETURN QUERY SELECT TRUE, '{}'::TEXT[], FALSE;
        RETURN;
    END IF;

    -- 4. Fetch titles of missing prerequisites for the UI message
    SELECT ARRAY_AGG(e.title ORDER BY e.event_date ASC) INTO v_missing_titles
    FROM public.events e
    WHERE e.id = ANY(v_missing);

    RETURN QUERY SELECT FALSE, v_missing_titles, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Row Level Security (RLS) for Overrides
-- =============================================================================
ALTER TABLE public.prerequisite_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own overrides"
ON public.prerequisite_overrides FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage overrides"
ON public.prerequisite_overrides FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE e.id = prerequisite_overrides.event_id
        AND cm.user_id = auth.uid() AND cm.role = 'admin'
    )
);
