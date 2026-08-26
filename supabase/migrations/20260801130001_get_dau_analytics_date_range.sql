-- Migration to support date range filtering in get_dau_analytics rpc
DROP FUNCTION IF EXISTS public.get_dau_analytics();

CREATE OR REPLACE FUNCTION public.get_dau_analytics(
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL
)
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
  WHERE 
    (start_date IS NULL OR s.activity_date >= start_date)
    AND (end_date IS NULL OR s.activity_date <= end_date)
  ORDER BY s.activity_date DESC
  LIMIT CASE WHEN start_date IS NULL AND end_date IS NULL THEN 90 ELSE NULL END;
END;
$$;

-- Grant execution permissions
REVOKE ALL ON FUNCTION public.get_dau_analytics(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dau_analytics(DATE, DATE) TO authenticated;
