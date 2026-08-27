-- Migration: 20261028000000_secure_api_key_management.sql
-- Description: Implement Secure API Key Management for Clubs with Hashed Keys (#3317).

-- Ensure pgcrypto extension is enabled for bcrypt hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create club_api_keys table
CREATE TABLE IF NOT EXISTS public.club_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    hashed_key TEXT NOT NULL,
    prefix TEXT NOT NULL,
    name TEXT NOT NULL,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.club_api_keys ENABLE ROW LEVEL SECURITY;

-- Allow service_role complete access
DROP POLICY IF EXISTS "service_role has full access to club_api_keys" ON public.club_api_keys;
CREATE POLICY "service_role has full access to club_api_keys"
    ON public.club_api_keys FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow approved club admins to select API keys
DROP POLICY IF EXISTS "Club admins can select their API keys" ON public.club_api_keys;
CREATE POLICY "Club admins can select their API keys" ON public.club_api_keys
    FOR SELECT TO authenticated
    USING (public.is_club_admin(club_id, auth.uid()));

-- Allow approved club admins to insert API keys
DROP POLICY IF EXISTS "Club admins can insert their API keys" ON public.club_api_keys;
CREATE POLICY "Club admins can insert their API keys" ON public.club_api_keys
    FOR INSERT TO authenticated
    WITH CHECK (public.is_club_admin(club_id, auth.uid()));

-- Allow approved club admins to delete API keys
DROP POLICY IF EXISTS "Club admins can delete their API keys" ON public.club_api_keys;
CREATE POLICY "Club admins can delete their API keys" ON public.club_api_keys
    FOR DELETE TO authenticated
    USING (public.is_club_admin(club_id, auth.uid()));

-- 2. Create RPC function to securely hash and register API keys
CREATE OR REPLACE FUNCTION public.create_club_api_key(
    p_club_id UUID,
    p_name TEXT,
    p_raw_key TEXT,
    p_prefix TEXT,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_key_id UUID;
    v_hashed TEXT;
BEGIN
    -- Check permissions
    IF NOT public.is_club_admin(p_club_id, auth.uid()) THEN
        RAISE EXCEPTION 'Access Denied: Only club administrators can generate keys.';
    END IF;

    -- Hash the key using pgcrypto blowfish/bcrypt
    v_hashed := crypt(p_raw_key, gen_salt('bf', 10));

    INSERT INTO public.club_api_keys (club_id, hashed_key, prefix, name, expires_at)
    VALUES (p_club_id, v_hashed, p_prefix, p_name, p_expires_at)
    RETURNING id INTO v_key_id;

    RETURN v_key_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_club_api_key(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- 3. Create RPC function to authenticate API keys
CREATE OR REPLACE FUNCTION public.authenticate_club_api_key(
    p_prefix TEXT,
    p_raw_key TEXT,
    p_club_id UUID
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_key_id UUID;
BEGIN
    -- Select the key where prefix matches and raw key matches the stored bcrypt hash
    SELECT id INTO v_key_id
    FROM public.club_api_keys
    WHERE prefix = p_prefix
      AND club_id = p_club_id
      AND hashed_key = crypt(p_raw_key, hashed_key)
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1;

    IF v_key_id IS NOT NULL THEN
        -- Log last usage timestamp
        UPDATE public.club_api_keys
        SET last_used_at = NOW()
        WHERE id = v_key_id;

        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.authenticate_club_api_key(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.authenticate_club_api_key(TEXT, TEXT, UUID) TO service_role;
