-- Migration: 20260840000001_scavenger_hunt_engine.sql
-- Description: Interactive Campus Scavenger Hunt Engine (#4043)

-- 1. Create hunt_waypoints table
DROP TABLE IF EXISTS public.hunt_progress CASCADE;
DROP TABLE IF EXISTS public.user_hunt_progress CASCADE;
DROP TABLE IF EXISTS public.hunt_waypoints CASCADE;
DROP TABLE IF EXISTS public.scavenger_hunts CASCADE;
DROP TABLE IF EXISTS public.hunts CASCADE;
DROP TABLE IF EXISTS public.clues CASCADE;

CREATE TABLE IF NOT EXISTS public.hunt_waypoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    clue_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(event_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_hunt_waypoints_event ON public.hunt_waypoints(event_id);

-- Enable RLS for hunt_waypoints
ALTER TABLE public.hunt_waypoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view hunt waypoints" ON public.hunt_waypoints FOR SELECT USING (true);
CREATE POLICY "Only club admins can modify hunt waypoints" ON public.hunt_waypoints FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.club_members cm ON cm.club_id = e.club_id
        WHERE e.id = hunt_waypoints.event_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
);


-- 2. Create hunt_progress table for tracking completion
CREATE TABLE IF NOT EXISTS public.hunt_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    waypoint_id UUID NOT NULL REFERENCES public.hunt_waypoints(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, waypoint_id)
);

CREATE INDEX IF NOT EXISTS idx_hunt_progress_event ON public.hunt_progress(event_id);
CREATE INDEX IF NOT EXISTS idx_hunt_progress_user ON public.hunt_progress(user_id);

-- Enable RLS for hunt_progress
ALTER TABLE public.hunt_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view hunt progress" ON public.hunt_progress FOR SELECT USING (true);
CREATE POLICY "Users can insert their own hunt progress" ON public.hunt_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Create verify_scavenger_hunt_location RPC
CREATE OR REPLACE FUNCTION public.verify_scavenger_hunt_location(
    p_event_id UUID,
    p_user_lat FLOAT,
    p_user_lng FLOAT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_completed_steps INT;
    v_total_steps INT;
    v_current_step INT;
    v_target_wp RECORD;
    v_distance_meters FLOAT;
    v_is_final BOOLEAN := FALSE;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Not authenticated');
    END IF;

    -- Get total steps
    SELECT COUNT(*) INTO v_total_steps FROM public.hunt_waypoints WHERE event_id = p_event_id;

    -- Get completed steps
    SELECT COALESCE(MAX(w.step_number), 0) INTO v_completed_steps
    FROM public.hunt_progress p
    JOIN public.hunt_waypoints w ON p.waypoint_id = w.id
    WHERE p.user_id = v_user_id AND w.event_id = p_event_id;

    v_current_step := v_completed_steps + 1;

    -- Get the target waypoint
    SELECT * INTO v_target_wp
    FROM public.hunt_waypoints
    WHERE event_id = p_event_id AND step_number = v_current_step;

    IF v_target_wp.id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'You have already completed all waypoints!');
    END IF;

    -- Haversine distance calculation
    v_distance_meters := 6371000 * 2 * ASIN(SQRT(
        POWER(SIN((v_target_wp.latitude - p_user_lat) * PI() / 180 / 2), 2) +
        COS(p_user_lat * PI() / 180) * COS(v_target_wp.latitude * PI() / 180) *
        POWER(SIN((v_target_wp.longitude - p_user_lng) * PI() / 180 / 2), 2)
    ));

    IF v_distance_meters > 20.0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'You are too far away! Get closer to the clue location.',
            'distance', v_distance_meters
        );
    END IF;

    -- Record progress
    INSERT INTO public.hunt_progress (event_id, user_id, waypoint_id)
    VALUES (p_event_id, v_user_id, v_target_wp.id)
    ON CONFLICT DO NOTHING;

    -- Award gamification points
    INSERT INTO public.points_ledger (user_id, amount, reason)
    VALUES (v_user_id, 10, 'Completed Scavenger Hunt Waypoint ' || v_current_step);

    IF v_current_step = v_total_steps THEN
        v_is_final := TRUE;
        -- Bonus points for completing the whole hunt
        INSERT INTO public.points_ledger (user_id, amount, reason)
        VALUES (v_user_id, 100, 'Completed Scavenger Hunt for event ' || p_event_id);
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', CASE WHEN v_is_final THEN 'Congratulations! You completed the Scavenger Hunt!' ELSE 'Location verified! Next clue unlocked.' END,
        'unlocked_step', v_current_step,
        'is_final', v_is_final
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_scavenger_hunt_location(UUID, FLOAT, FLOAT) TO authenticated;

-- 4. Create RPC to fetch current clue (anti-cheat)
CREATE OR REPLACE FUNCTION public.get_current_scavenger_hunt_clue(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_completed_steps INT;
    v_total_steps INT;
    v_target_wp RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', FALSE, 'message', 'Not authenticated');
    END IF;

    SELECT COUNT(*) INTO v_total_steps FROM public.hunt_waypoints WHERE event_id = p_event_id;

    SELECT COALESCE(MAX(w.step_number), 0) INTO v_completed_steps
    FROM public.hunt_progress p
    JOIN public.hunt_waypoints w ON p.waypoint_id = w.id
    WHERE p.user_id = v_user_id AND w.event_id = p_event_id;

    IF v_completed_steps >= v_total_steps THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'is_completed', TRUE,
            'completed_steps', v_completed_steps,
            'total_steps', v_total_steps
        );
    END IF;

    SELECT * INTO v_target_wp
    FROM public.hunt_waypoints
    WHERE event_id = p_event_id AND step_number = (v_completed_steps + 1);

    RETURN jsonb_build_object(
        'success', TRUE,
        'is_completed', FALSE,
        'completed_steps', v_completed_steps,
        'total_steps', v_total_steps,
        'clue_text', v_target_wp.clue_text
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_current_scavenger_hunt_clue(UUID) TO authenticated;

-- 5. Create RPC for leaderboard
CREATE OR REPLACE FUNCTION public.get_scavenger_hunt_leaderboard(p_event_id UUID)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    avatar_url TEXT,
    completed_steps INT,
    last_completed_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT
        p.user_id,
        COALESCE(prof.full_name, 'Explorer') as full_name,
        prof.avatar_url,
        COUNT(p.waypoint_id)::INT as completed_steps,
        MAX(p.completed_at) as last_completed_at
    FROM public.hunt_progress p
    LEFT JOIN public.profiles prof ON prof.id = p.user_id
    WHERE p.event_id = p_event_id
    GROUP BY p.user_id, prof.full_name, prof.avatar_url
    ORDER BY completed_steps DESC, last_completed_at ASC
    LIMIT 50;
$$;
GRANT EXECUTE ON FUNCTION public.get_scavenger_hunt_leaderboard(UUID) TO authenticated;

