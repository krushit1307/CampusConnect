-- =============================================================================
-- Migration: 20260803000000_table_count_estimate.sql
-- Purpose: Optimize massive COUNT(*) queries using pg_class internal stats,
--          with a dynamic fallback for smaller tables.
-- =============================================================================

-- 1. Create public.user_activity_logs table for testing and auditing
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security (RLS) on user_activity_logs
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own activity logs, and system admins to view all
CREATE POLICY "Admins can view all user activity logs"
ON public.user_activity_logs
FOR SELECT
TO authenticated
USING (public.is_system_admin());

CREATE POLICY "Users can view their own activity logs"
ON public.user_activity_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2. Create the RPC function get_table_row_count_estimate
CREATE OR REPLACE FUNCTION public.get_table_row_count_estimate(p_table_name TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_estimate BIGINT;
BEGIN
    -- Query pg_class to extract row count estimate
    SELECT reltuples::bigint INTO v_estimate
    FROM pg_class
    WHERE relname = p_table_name;
    
    -- Fallback: if estimate is NULL or relatively small (< 10000), execute exact COUNT(*)
    IF v_estimate IS NULL OR v_estimate < 10000 THEN
        EXECUTE format('SELECT COUNT(*)::bigint FROM %I', p_table_name) INTO v_estimate;
    END IF;
    
    RETURN v_estimate;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_table_row_count_estimate(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_row_count_estimate(TEXT) TO anon;
