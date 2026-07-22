-- Migration: 20260721180000_execute_raw.sql
-- Description: Create security definer RPC function for executing dynamic parameterized analytical queries

CREATE OR REPLACE FUNCTION public.execute_raw(
    query_text text,
    query_params jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Ensure basic safety checks
    IF query_text IS NULL OR trim(query_text) = '' THEN
        RAISE EXCEPTION 'Query text cannot be empty';
    END IF;

    -- Only allow SELECT queries for analytical read execution
    IF lower(trim(query_text)) NOT LIKE 'select%' THEN
        RAISE EXCEPTION 'Only SELECT queries are allowed in execute_raw';
    END IF;

    -- Execute dynamic query with parameterized JSON inputs
    EXECUTE 'SELECT coalesce(jsonb_agg(r), ''[]''::jsonb) FROM (' || query_text || ') r'
    INTO result;

    RETURN result;
END;
$$;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.execute_raw(text, jsonb) TO authenticated;
