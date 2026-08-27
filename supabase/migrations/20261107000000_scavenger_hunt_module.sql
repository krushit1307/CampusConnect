-- Migration: Scavenger Hunt Engine Module (#2801)
-- Description: Creates full schema for campus scavenger hunts, clues, progress tracking, anti-cheating GPS/QR verification, and leaderboard.

CREATE TABLE IF NOT EXISTS public.hunts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id UUID NOT NULL REFERENCES public.hunts(id) ON DELETE CASCADE,
    sequence_order INT NOT NULL,
    hint_text TEXT NOT NULL,
    secret_qr_payload TEXT NOT NULL,
    target_lat FLOAT,
    target_lng FLOAT,
    points INT NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (hunt_id, sequence_order)
);

CREATE TABLE IF NOT EXISTS public.hunt_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id UUID NOT NULL REFERENCES public.hunts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_clue_order INT NOT NULL DEFAULT 1,
    total_score INT NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (hunt_id, user_id)
);

-- Enable RLS
ALTER TABLE public.hunts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hunt_progress ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public can view active hunts" ON public.hunts;
    CREATE POLICY "Public can view active hunts" ON public.hunts FOR SELECT USING (TRUE);

    DROP POLICY IF EXISTS "Organizers can manage own hunts" ON public.hunts;
    CREATE POLICY "Organizers can manage own hunts" ON public.hunts FOR ALL USING (auth.uid() = created_by);

    DROP POLICY IF EXISTS "Users can view progress" ON public.hunt_progress;
    CREATE POLICY "Users can view progress" ON public.hunt_progress FOR SELECT USING (TRUE);

    DROP POLICY IF EXISTS "Users can update own progress" ON public.hunt_progress;
    CREATE POLICY "Users can update own progress" ON public.hunt_progress FOR ALL USING (auth.uid() = user_id);
END $$;

-- Anti-Cheating RPC: Returns ONLY the clue for the user's CURRENT sequence order
CREATE OR REPLACE FUNCTION public.get_user_current_clue(
    p_hunt_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    clue_id UUID,
    sequence_order INT,
    hint_text TEXT,
    target_lat FLOAT,
    target_lng FLOAT,
    points INT,
    total_clues INT,
    current_score INT,
    is_completed BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
    v_current_order INT := 1;
    v_total_clues INT := 0;
    v_score INT := 0;
    v_completed_at TIMESTAMPTZ := NULL;
BEGIN
    SELECT current_clue_order, total_score, completed_at 
    INTO v_current_order, v_score, v_completed_at
    FROM public.hunt_progress
    WHERE hunt_id = p_hunt_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        v_current_order := 1;
        v_score := 0;
    END IF;

    SELECT COUNT(*) INTO v_total_clues FROM public.clues WHERE hunt_id = p_hunt_id;

    RETURN QUERY
    SELECT 
        c.id,
        c.sequence_order,
        c.hint_text,
        c.target_lat,
        c.target_lng,
        c.points,
        v_total_clues,
        v_score,
        (v_completed_at IS NOT NULL)
    FROM public.clues c
    WHERE c.hunt_id = p_hunt_id AND c.sequence_order = v_current_order;
END;
$$;

-- Verification RPC: Validates Secret QR payload and Haversine distance
CREATE OR REPLACE FUNCTION public.submit_clue_scan(
    p_hunt_id UUID,
    p_user_id UUID,
    p_qr_payload TEXT,
    p_user_lat FLOAT DEFAULT NULL,
    p_user_lng FLOAT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_clue_order INT,
    total_score INT,
    is_completed BOOLEAN
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
    v_curr_order INT := 1;
    v_curr_score INT := 0;
    v_clue RECORD;
    v_total_clues INT;
    v_distance_meters FLOAT;
    v_rad_lat1 FLOAT;
    v_rad_lat2 FLOAT;
    v_delta_lat FLOAT;
    v_delta_lng FLOAT;
    v_a FLOAT;
    v_c FLOAT;
BEGIN
    SELECT current_clue_order, total_score INTO v_curr_order, v_curr_score
    FROM public.hunt_progress
    WHERE hunt_id = p_hunt_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        v_curr_order := 1;
        v_curr_score := 0;
        INSERT INTO public.hunt_progress (hunt_id, user_id, current_clue_order, total_score)
        VALUES (p_hunt_id, p_user_id, 1, 0);
    END IF;

    -- Fetch the target clue for this user's current step
    SELECT * INTO v_clue
    FROM public.clues
    WHERE hunt_id = p_hunt_id AND sequence_order = v_curr_order;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'No active clue found for your current step.', v_curr_order, v_curr_score, TRUE;
        RETURN;
    END IF;

    -- 1. Verify Secret QR Payload
    IF TRIM(p_qr_payload) <> TRIM(v_clue.secret_qr_payload) THEN
        RETURN QUERY SELECT FALSE, 'Invalid QR code! This does not match your current clue target.', v_curr_order, v_curr_score, FALSE;
        RETURN;
    END IF;

    -- 2. Verify Geo-distance if target coordinates exist and user provided GPS
    IF v_clue.target_lat IS NOT NULL AND v_clue.target_lng IS NOT NULL AND p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
        v_rad_lat1 := radians(p_user_lat);
        v_rad_lat2 := radians(v_clue.target_lat);
        v_delta_lat := radians(v_clue.target_lat - p_user_lat);
        v_delta_lng := radians(v_clue.target_lng - p_user_lng);
        v_a := sin(v_delta_lat / 2)^2 + cos(v_rad_lat1) * cos(v_rad_lat2) * sin(v_delta_lng / 2)^2;
        v_c := 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
        v_distance_meters := 6371000 * v_c;

        IF v_distance_meters > 50.0 THEN -- 50 meters max geo-fence for physical presence
            RETURN QUERY SELECT FALSE, 'Location mismatch: You must be physically at the clue location to scan.', v_curr_order, v_curr_score, FALSE;
            RETURN;
        END IF;
    END IF;

    -- Count total clues
    SELECT COUNT(*) INTO v_total_clues FROM public.clues WHERE hunt_id = p_hunt_id;
    v_curr_score := v_curr_score + v_clue.points;

    IF v_curr_order >= v_total_clues THEN
        UPDATE public.hunt_progress
        SET total_score = v_curr_score, completed_at = NOW(), updated_at = NOW()
        WHERE hunt_id = p_hunt_id AND user_id = p_user_id;

        RETURN QUERY SELECT TRUE, 'Awesome! You have solved all clues and completed the Scavenger Hunt!', v_curr_order, v_curr_score, TRUE;
    ELSE
        v_curr_order := v_curr_order + 1;
        UPDATE public.hunt_progress
        SET current_clue_order = v_curr_order, total_score = v_curr_score, updated_at = NOW()
        WHERE hunt_id = p_hunt_id AND user_id = p_user_id;

        RETURN QUERY SELECT TRUE, 'Clue Solved! The next clue has been revealed.', v_curr_order, v_curr_score, FALSE;
    END IF;
END;
$$;

-- Leaderboard RPC
CREATE OR REPLACE FUNCTION public.get_scavenger_hunt_leaderboard(p_hunt_id UUID)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    avatar_url TEXT,
    current_clue_order INT,
    total_score INT,
    completed_at TIMESTAMPTZ,
    duration_seconds INT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT 
        p.user_id,
        COALESCE(prof.full_name, 'Explorer') as full_name,
        prof.avatar_url,
        p.current_clue_order,
        p.total_score,
        p.completed_at,
        CASE 
            WHEN p.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (p.completed_at - p.created_at))::INT
            ELSE NULL
        END as duration_seconds
    FROM public.hunt_progress p
    LEFT JOIN public.profiles prof ON prof.id = p.user_id
    WHERE p.hunt_id = p_hunt_id
    ORDER BY p.completed_at ASC NULLS LAST, p.total_score DESC, p.current_clue_order DESC
    LIMIT 50;
$$;
