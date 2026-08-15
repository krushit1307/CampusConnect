-- =============================================================================
-- Migration: 20260802000001_system_counters_rpc.sql
-- Purpose: Provide a secure RPC function to fetch multiple counts in one call.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_system_counts()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT sc.table_name, sc.row_count, sc.updated_at
    FROM public.system_counters sc
    ORDER BY sc.table_name;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_system_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_counts() TO anon;
