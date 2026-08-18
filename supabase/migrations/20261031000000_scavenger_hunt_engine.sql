-- Migration: 20261031000000_scavenger_hunt_engine.sql
-- Description: Implement Scavenger Hunt Gamification engine tables and RPCs (#3338).

-- 1. Create scavenger_hunts table
CREATE TABLE IF NOT EXISTS public.scavenger_hunts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.scavenger_hunts ENABLE ROW LEVEL SECURITY;

-- Select policy
DROP POLICY IF EXISTS "Anyone can select scavenger hunts" ON public.scavenger_hunts;
CREATE POLICY "Anyone can select scavenger hunts" ON public.scavenger_hunts
    FOR SELECT TO authenticated USING (true);

-- Insert/Update/Delete policy
DROP POLICY IF EXISTS "System administrators can manage scavenger hunts" ON public.scavenger_hunts;
CREATE POLICY "System administrators can manage scavenger hunts" ON public.scavenger_hunts
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'system_admin'
        )
    );

-- 2. Create hunt_waypoints table
CREATE TABLE IF NOT EXISTS public.hunt_waypoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id UUID NOT NULL REFERENCES public.scavenger_hunts(id) ON DELETE CASCADE,
    clue_text TEXT NOT NULL,
    secret_qr_hash TEXT NOT NULL,
    step_number INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(hunt_id, step_number)
);

-- Enable RLS
ALTER TABLE public.hunt_waypoints ENABLE ROW LEVEL SECURITY;

-- Select policy
DROP POLICY IF EXISTS "Anyone can select hunt waypoints" ON public.hunt_waypoints;
CREATE POLICY "Anyone can select hunt waypoints" ON public.hunt_waypoints
    FOR SELECT TO authenticated USING (true);

-- Insert/Update/Delete policy
DROP POLICY IF EXISTS "System administrators can manage waypoints" ON public.hunt_waypoints;
CREATE POLICY "System administrators can manage waypoints" ON public.hunt_waypoints
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'system_admin'
        )
    );

-- 3. Create user_hunt_progress table
CREATE TABLE IF NOT EXISTS public.user_hunt_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    hunt_id UUID NOT NULL REFERENCES public.scavenger_hunts(id) ON DELETE CASCADE,
    waypoint_id UUID NOT NULL REFERENCES public.hunt_waypoints(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, waypoint_id)
);

-- Enable RLS
ALTER TABLE public.user_hunt_progress ENABLE ROW LEVEL SECURITY;

-- Progress policy
DROP POLICY IF EXISTS "Users can view and manage their own progress" ON public.user_hunt_progress;
CREATE POLICY "Users can view and manage their own progress" ON public.user_hunt_progress
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 4. Create submit_waypoint_scan RPC
CREATE OR REPLACE FUNCTION public.submit_waypoint_scan(
    p_hunt_id UUID,
    p_qr_hash TEXT
) RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_current_step INT;
    v_target_waypoint RECORD;
    v_total_steps INT;
    v_completed_steps INT;
    v_is_final BOOLEAN := FALSE;
BEGIN
    -- Check authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Determine next step number the user needs to resolve
    SELECT COALESCE(MAX(w.step_number), 0) INTO v_completed_steps
    FROM public.user_hunt_progress p
    JOIN public.hunt_waypoints w ON p.waypoint_id = w.id
    WHERE p.user_id = v_user_id AND w.hunt_id = p_hunt_id;

    v_current_step := v_completed_steps + 1;

    -- 2. Retrieve waypoint matching step
    SELECT * INTO v_target_waypoint
    FROM public.hunt_waypoints
    WHERE hunt_id = p_hunt_id AND step_number = v_current_step;

    IF v_target_waypoint.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'You have already completed all waypoints for this scavenger hunt!'
        );
    END IF;

    -- 3. Verify cryptographic hash match
    IF v_target_waypoint.secret_qr_hash != p_qr_hash THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Incorrect location QR code! Keep searching.'
        );
    END IF;

    -- 4. Record progress
    INSERT INTO public.user_hunt_progress (user_id, hunt_id, waypoint_id)
    VALUES (v_user_id, p_hunt_id, v_target_waypoint.id)
    ON CONFLICT (user_id, waypoint_id) DO NOTHING;

    -- 5. Calculate if completed final step
    SELECT COUNT(*)::int INTO v_total_steps
    FROM public.hunt_waypoints
    WHERE hunt_id = p_hunt_id;

    IF v_current_step = v_total_steps THEN
        v_is_final := TRUE;

        -- Award 1000 Gamification Points
        INSERT INTO public.points_ledger (user_id, amount, source_type, source_id, description)
        VALUES (
            v_user_id,
            1000,
            'scavenger_hunt',
            p_hunt_id,
            'Completed Scavenger Hunt!'
        )
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'unlocked_step', v_current_step,
        'is_final', v_is_final,
        'message', CASE WHEN v_is_final THEN 'Congratulations! You completed the Scavenger Hunt!' ELSE 'Clue unlocked successfully!' END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_waypoint_scan(UUID, TEXT) TO authenticated;

-- 5. Create get_scavenger_hunt_progress RPC
CREATE OR REPLACE FUNCTION public.get_scavenger_hunt_progress(p_hunt_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_completed_steps INT;
    v_total_steps INT;
    v_next_clue TEXT;
    v_is_completed BOOLEAN := FALSE;
BEGIN
    -- Count total steps
    SELECT COUNT(*)::int INTO v_total_steps
    FROM public.hunt_waypoints
    WHERE hunt_id = p_hunt_id;

    -- Count completed steps
    SELECT COALESCE(MAX(w.step_number), 0) INTO v_completed_steps
    FROM public.user_hunt_progress p
    JOIN public.hunt_waypoints w ON p.waypoint_id = w.id
    WHERE p.user_id = v_user_id AND w.hunt_id = p_hunt_id;

    IF v_completed_steps = v_total_steps AND v_total_steps > 0 THEN
        v_is_completed := TRUE;
    ELSE
        -- Fetch next clue
        SELECT clue_text INTO v_next_clue
        FROM public.hunt_waypoints
        WHERE hunt_id = p_hunt_id AND step_number = (v_completed_steps + 1);
    END IF;

    RETURN jsonb_build_object(
        'completed_steps', v_completed_steps,
        'total_steps', v_total_steps,
        'is_completed', v_is_completed,
        'next_clue', COALESCE(v_next_clue, '')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_scavenger_hunt_progress(UUID) TO authenticated;
