-- Migration: Optimize DAU calculations with a Materialized View and Security-restricted RPC

-- 1. Drop existing view to prevent conflicts
DROP VIEW IF EXISTS public.daily_active_users_90_days;

-- 2. Create the Materialized View
CREATE MATERIALIZED VIEW IF NOT EXISTS public.daily_active_users_summary AS
SELECT
    activity_date,
    COUNT(user_id) AS daily_active_users
FROM public.user_sessions
GROUP BY activity_date;

-- 3. Create unique index on Materialized View for concurrent refreshes
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_active_users_summary_date 
ON public.daily_active_users_summary (activity_date);

-- 4. Re-create the daily_active_users_90_days view on top of the materialized view
CREATE OR REPLACE VIEW public.daily_active_users_90_days AS
SELECT
    activity_date,
    daily_active_users
FROM public.daily_active_users_summary
WHERE activity_date >= (CURRENT_DATE - 90)
ORDER BY activity_date DESC;

-- 5. Expose RPC get_dau_analytics for admins with strict role security
CREATE OR REPLACE FUNCTION public.get_dau_analytics()
RETURNS TABLE (
    activity_date DATE,
    daily_active_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security check: only system_admin role is allowed
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'system_admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. System admin privileges required.';
  END IF;

  RETURN QUERY
  SELECT 
    s.activity_date,
    s.daily_active_users::BIGINT
  FROM public.daily_active_users_summary s
  ORDER BY s.activity_date DESC
  LIMIT 90;
END;
$$;

-- 6. Grants & Permissions
REVOKE ALL ON public.daily_active_users_summary FROM PUBLIC;
GRANT SELECT ON public.daily_active_users_summary TO authenticated, service_role;

REVOKE ALL ON public.daily_active_users_90_days FROM PUBLIC;
GRANT SELECT ON public.daily_active_users_90_days TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_dau_analytics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dau_analytics() TO authenticated;

-- 7. Register pg_cron task to refresh view nightly
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'refresh-dau-materialized-view',
    '0 0 * * *', -- Nightly at midnight
    $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.daily_active_users_summary$$
);
