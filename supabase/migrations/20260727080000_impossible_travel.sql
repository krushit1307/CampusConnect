-- ============================================================
-- Migration: 20260727080000_impossible_travel.sql
-- Description:
-- Adds columns to profiles to support account locking,
-- creates the login_history table, and adds the check_impossible_travel RPC.
-- ============================================================

-- 1. Add lock columns to public.profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS unlock_token UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Create public.login_history table
CREATE TABLE IF NOT EXISTS public.login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    city TEXT,
    country TEXT,
    login_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. Enable Row Level Security (RLS) on login_history
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for login_history
-- Only service_role (backend) has full access
DROP POLICY IF EXISTS "Service role has full access to login_history" ON public.login_history;
CREATE POLICY "Service role has full access to login_history" ON public.login_history
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow authenticated users to view their own login history
DROP POLICY IF EXISTS "Users can view their own login history" ON public.login_history;
CREATE POLICY "Users can view their own login history" ON public.login_history
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 5. Create RPC function to check for impossible travel
CREATE OR REPLACE FUNCTION public.check_impossible_travel(
    p_user_id UUID,
    p_lat DOUBLE PRECISION,
    p_lon DOUBLE PRECISION
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prev_lat DOUBLE PRECISION;
    v_prev_lon DOUBLE PRECISION;
    v_prev_login_at TIMESTAMP WITH TIME ZONE;
    v_distance DOUBLE PRECISION;
    v_hours DOUBLE PRECISION;
BEGIN
    -- Query the latest successful login for this user
    SELECT latitude, longitude, login_at
    INTO v_prev_lat, v_prev_lon, v_prev_login_at
    FROM public.login_history
    WHERE user_id = p_user_id
    ORDER BY login_at DESC
    LIMIT 1;

    -- If no previous login exists, travel is possible
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Calculate distance using the existing haversine_distance function
    v_distance := public.haversine_distance(v_prev_lat, v_prev_lon, p_lat, p_lon);

    -- Calculate time difference in hours (EPOCH returns seconds, divide by 3600.0)
    v_hours := EXTRACT(EPOCH FROM (now() - v_prev_login_at)) / 3600.0;

    -- Prevent division by zero or extremely small time increments
    IF v_hours < 0.0028 THEN -- less than 10 seconds
        IF v_distance > 1.0 THEN
            RETURN TRUE; -- travelling > 1km in < 10 seconds is physically impossible
        ELSE
            RETURN FALSE; -- likely concurrent logins from the same place
        END IF;
    END IF;

    -- Calculate speed (km/h) and check if it exceeds 1000 km/h
    IF (v_distance / v_hours) > 1000.0 THEN
        RETURN TRUE; -- Impossible travel detected
    END IF;

    RETURN FALSE;
END;
$$;

-- Grant execute to authenticated and anon users (the proxy uses anon/service_role keys)
GRANT EXECUTE ON FUNCTION public.check_impossible_travel(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated, service_role;
