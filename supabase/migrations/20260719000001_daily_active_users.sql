-- 1. Create a lightweight table for storing historical user session activity.
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT user_sessions_user_date_key UNIQUE (user_id, activity_date)
);

-- 2. Index for fast date filtering in the DAU view.
CREATE INDEX IF NOT EXISTS idx_user_sessions_activity_date 
    ON public.user_sessions (activity_date DESC);

-- 3. Enable RLS. 
-- We intentionally do NOT create any policies. The client should not 
-- directly read or write to this table. All access goes through the RPC.
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Create an RPC for the client to securely record a session
CREATE OR REPLACE FUNCTION public.record_daily_session()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Ensure the user is authenticated
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    -- Insert the session, ignoring if already recorded today
    INSERT INTO public.user_sessions (user_id, activity_date)
    VALUES (auth.uid(), CURRENT_DATE)
    ON CONFLICT (user_id, activity_date) DO NOTHING;
END;
$$;

-- Secure the RPC
REVOKE ALL ON FUNCTION public.record_daily_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_daily_session() TO authenticated;

-- 5. Daily Active Users for the previous 90 days.
CREATE OR REPLACE VIEW public.daily_active_users_90_days AS
SELECT
    activity_date,
    COUNT(user_id) AS daily_active_users
FROM public.user_sessions
WHERE activity_date >= (CURRENT_DATE - 90) -- Integer subtraction returns a pure DATE
GROUP BY activity_date
ORDER BY activity_date DESC;

-- 6. Restrict access to the analytics view.
REVOKE ALL ON public.daily_active_users_90_days FROM PUBLIC;
GRANT SELECT ON public.daily_active_users_90_days TO authenticated, service_role;