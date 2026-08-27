-- Migration: 20260812200000_scavenger_hunt_engine.sql
-- Description: Create tables for orientation scavenger hunt engine,
--               anti-cheating current waypoint RPC, 15m Haversine distance verification RPC,
--               and leaderboard RPC (#3004).

-- 1. Create hunts table
CREATE TABLE IF NOT EXISTS public.hunts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create hunt_waypoints table
CREATE TABLE IF NOT EXISTS public.hunt_waypoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id UUID REFERENCES public.hunts(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    clue_text TEXT NOT NULL,
    lat FLOAT NOT NULL,
    lng FLOAT NOT NULL,
    qr_code_hash TEXT, -- Fallback for indoor GPS bouncing
    points INT NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (hunt_id, step_order)
);

-- 3. Create hunt_progress table
CREATE TABLE IF NOT EXISTS public.hunt_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id UUID REFERENCES public.hunts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    current_step INT NOT NULL DEFAULT 1,
    total_score INT NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (hunt_id, user_id)
);

-- Enable RLS
ALTER TABLE public.hunts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hunt_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hunt_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active hunts" ON public.hunts FOR SELECT USING (TRUE);
CREATE POLICY "Authenticated users can view hunt progress" ON public.hunt_progress FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Anti-Cheating RPC: Only returns coordinates/clue for the CURRENT step the user is on
CREATE OR REPLACE FUNCTION public.get_current_waypoint_clue(
    p_hunt_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    waypoint_id UUID,
    step_order INT,
    clue_text TEXT,
    lat FLOAT,
    lng FLOAT,
    points INT,
    total_steps INT,
    current_score INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
    v_current_step INT := 1;
    v_total_steps INT := 0;
    v_score INT := 0;
BEGIN
    -- Get user progress or initialize
    SELECT current_step, total_score INTO v_current_step, v_score
    FROM public.hunt_progress
    WHERE hunt_id = p_hunt_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        v_current_step := 1;
        v_score := 0;
    END IF;

    -- Count total waypoints in hunt
    SELECT COUNT(*) INTO v_total_steps FROM public.hunt_waypoints WHERE hunt_id = p_hunt_id;

    -- Return ONLY the current step waypoint (future waypoints remain hidden on server)
    RETURN QUERY
    SELECT 
        w.id,
        w.step_order,
        w.clue_text,
        w.lat,
        w.lng,
        w.points,
        v_total_steps,
        v_score
    FROM public.hunt_waypoints w
    WHERE w.hunt_id = p_hunt_id AND w.step_order = v_current_step;
END;
$$;

-- 5. Verification RPC: Checks distance (15m threshold using Haversine) or QR code fallback
CREATE OR REPLACE FUNCTION public.verify_waypoint_checkin(
    p_hunt_id UUID,
    p_user_id UUID,
    p_user_lat FLOAT,
    p_user_lng FLOAT,
    p_qr_code TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_step INT,
    total_score INT,
    is_completed BOOLEAN
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
    v_curr_step INT := 1;
    v_curr_score INT := 0;
    v_wp RECORD;
    v_distance_meters FLOAT;
    v_total_steps INT;
    v_is_valid BOOLEAN := FALSE;
    v_rad_lat1 FLOAT;
    v_rad_lat2 FLOAT;
    v_delta_lat FLOAT;
    v_delta_lng FLOAT;
    v_a FLOAT;
    v_c FLOAT;
BEGIN
    -- Get user progress
    SELECT current_step, total_score INTO v_curr_step, v_curr_score
    FROM public.hunt_progress
    WHERE hunt_id = p_hunt_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        v_curr_step := 1;
        v_curr_score := 0;
        INSERT INTO public.hunt_progress (hunt_id, user_id, current_step, total_score)
        VALUES (p_hunt_id, p_user_id, 1, 0);
    END IF;

    -- Get current waypoint
    SELECT * INTO v_wp
    FROM public.hunt_waypoints
    WHERE hunt_id = p_hunt_id AND step_order = v_curr_step;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'No active waypoint found for this step.', v_curr_step, v_curr_score, TRUE;
        RETURN;
    END IF;

    -- Check QR code match fallback
    IF p_qr_code IS NOT NULL AND v_wp.qr_code_hash IS NOT NULL AND p_qr_code = v_wp.qr_code_hash THEN
        v_is_valid := TRUE;
    ELSE
        -- Calculate Haversine Distance in meters
        v_rad_lat1 := radians(p_user_lat);
        v_rad_lat2 := radians(v_wp.lat);
        v_delta_lat := radians(v_wp.lat - p_user_lat);
        v_delta_lng := radians(v_wp.lng - p_user_lng);

        v_a := sin(v_delta_lat / 2)^2 + cos(v_rad_lat1) * cos(v_rad_lat2) * sin(v_delta_lng / 2)^2;
        v_c := 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
        v_distance_meters := 6371000 * v_c; -- Earth radius 6,371km in meters

        IF v_distance_meters <= 15.0 THEN
            v_is_valid := TRUE;
        END IF;
    END IF;

    IF NOT v_is_valid THEN
        RETURN QUERY SELECT FALSE, 'You are not close enough to the waypoint location (must be within 15 meters).', v_curr_step, v_curr_score, FALSE;
        RETURN;
    END IF;

    -- Award points & advance step
    SELECT COUNT(*) INTO v_total_steps FROM public.hunt_waypoints WHERE hunt_id = p_hunt_id;
    v_curr_score := v_curr_score + v_wp.points;

    IF v_curr_step >= v_total_steps THEN
        UPDATE public.hunt_progress
        SET total_score = v_curr_score, completed_at = NOW(), updated_at = NOW()
        WHERE hunt_id = p_hunt_id AND user_id = p_user_id;

        RETURN QUERY SELECT TRUE, 'Congratulations! You have completed the Scavenger Hunt!', v_curr_step, v_curr_score, TRUE;
    ELSE
        v_curr_step := v_curr_step + 1;
        UPDATE public.hunt_progress
        SET current_step = v_curr_step, total_score = v_curr_score, updated_at = NOW()
        WHERE hunt_id = p_hunt_id AND user_id = p_user_id;

        RETURN QUERY SELECT TRUE, 'Waypoint Found! Next clue unlocked.', v_curr_step, v_curr_score, FALSE;
    END IF;
END;
$$;

-- 6. Leaderboard RPC
CREATE OR REPLACE FUNCTION public.get_hunt_leaderboard(p_hunt_id UUID)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    current_step INT,
    total_score INT,
    completed_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT 
        p.user_id,
        u.email,
        p.current_step,
        p.total_score,
        p.completed_at
    FROM public.hunt_progress p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.hunt_id = p_hunt_id
    ORDER BY p.total_score DESC, p.completed_at ASC NULLS LAST
    LIMIT 50;
$$;
