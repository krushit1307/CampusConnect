-- Migration: 20260721190000_drop_execute_raw.sql
-- Description: Remove the insecure execute_raw RPC function that allowed any
-- authenticated user to execute arbitrary SELECT queries under SECURITY DEFINER privileges.

REVOKE EXECUTE ON FUNCTION public.execute_raw(text, jsonb) FROM authenticated;

DROP FUNCTION IF EXISTS public.execute_raw;
