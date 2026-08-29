-- ============================================================
-- Migration: 20270306000000_dietary_yield_optimizer.sql
-- Issue: #4220 — Dynamic "Dietary Yield" Optimizer
-- ============================================================

-- 1. Add assigned_dietary_meal to event_rsvps table
ALTER TABLE public.event_rsvps 
ADD COLUMN IF NOT EXISTS assigned_dietary_meal TEXT DEFAULT NULL;

-- 2. Create event_dietary_constraints table
CREATE TABLE IF NOT EXISTS public.event_dietary_constraints (
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    dietary_tag TEXT NOT NULL,
    minimum_order_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, dietary_tag)
);

CREATE INDEX IF NOT EXISTS idx_event_dietary_constraints_event_id
ON public.event_dietary_constraints(event_id);

-- 3. Enable Row Level Security
ALTER TABLE public.event_dietary_constraints ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
DROP POLICY IF EXISTS "Anyone can view dietary constraints" ON public.event_dietary_constraints;
CREATE POLICY "Anyone can view dietary constraints"
ON public.event_dietary_constraints
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Organizers can manage dietary constraints" ON public.event_dietary_constraints;
CREATE POLICY "Organizers can manage dietary constraints"
ON public.event_dietary_constraints
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.events e
        JOIN public.clubs c ON c.id = e.club_id
        WHERE e.id = event_dietary_constraints.event_id
          AND (
              c.created_by = auth.uid()
              OR EXISTS (
                  SELECT 1
                  FROM public.club_members cm
                  WHERE cm.club_id = c.id
                    AND cm.user_id = auth.uid()
                    AND cm.role = 'admin'
                    AND cm.status = 'approved'
              )
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.events e
        JOIN public.clubs c ON c.id = e.club_id
        WHERE e.id = event_dietary_constraints.event_id
          AND (
              c.created_by = auth.uid()
              OR EXISTS (
                  SELECT 1
                  FROM public.club_members cm
                  WHERE cm.club_id = c.id
                    AND cm.user_id = auth.uid()
                    AND cm.role = 'admin'
                    AND cm.status = 'approved'
              )
          )
    )
);

-- 5. Create assign_excess_dietary_meals RPC
CREATE OR REPLACE FUNCTION public.assign_excess_dietary_meals(
    p_event_id UUID,
    p_dietary_tag TEXT,
    p_excess_count INTEGER
)
RETURNS TABLE (
    user_id UUID,
    name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rsvps_to_assign UUID[];
BEGIN
    -- Identify "General" attendees who:
    --    - RSVP status is 'attending'
    --    - Are attending this event
    --    - Have NO dietary restrictions (dietary_restrictions is null, empty, or only contains 'none')
    --    - Do not already have an assigned dietary meal
    --    - Ordered randomly up to p_excess_count
    SELECT array_agg(r.user_id) INTO v_rsvps_to_assign
    FROM (
        SELECT r.user_id
        FROM public.event_rsvps r
        JOIN public.user_preferences up ON up.user_id = r.user_id
        WHERE r.event_id = p_event_id
          AND r.status = 'attending'
          AND r.assigned_dietary_meal IS NULL
          AND (
              up.dietary_restrictions IS NULL
              OR array_length(up.dietary_restrictions, 1) IS NULL
              OR up.dietary_restrictions = ARRAY['none']::TEXT[]
              OR up.dietary_restrictions = ARRAY[]::TEXT[]
          )
        ORDER BY random()
        LIMIT p_excess_count
    ) r;

    -- Update their event_rsvps records
    IF v_rsvps_to_assign IS NOT NULL AND array_length(v_rsvps_to_assign, 1) > 0 THEN
        UPDATE public.event_rsvps
        SET assigned_dietary_meal = p_dietary_tag
        WHERE event_id = p_event_id
          AND user_id = any(v_rsvps_to_assign);

        -- Return the names of users who got assigned the meals
        RETURN QUERY
        SELECT p.id as user_id, (p.first_name || ' ' || p.last_name)::TEXT as name
        FROM public.profiles p
        WHERE p.id = any(v_rsvps_to_assign);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_excess_dietary_meals(UUID, TEXT, INTEGER) TO authenticated;
