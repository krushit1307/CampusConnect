-- Migration: 20260726000000_webauthn_user_lookup_rpc.sql
--
-- Adds a targeted, index-backed helper for WebAuthn auth-options to look up
-- a user by email without fetching the entire auth.users table.
--
-- Why SECURITY DEFINER:
--   auth.users is not directly readable by the 'authenticated' or 'anon' role.
--   The service-role key bypasses RLS but the function itself is the cleanest
--   way to expose a single, auditable lookup path.
--
-- Least-privilege: the function returns only (id, email) — no password hashes,
-- no phone numbers, no raw_app_meta_data.

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(target_email TEXT)
RETURNS TABLE (user_id UUID, user_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
-- Restrict execution to the service_role so anonymous callers cannot invoke it.
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT au.id, au.email::TEXT
    FROM auth.users au
    WHERE au.email = target_email
    LIMIT 1;
END;
$$;

-- Revoke from public, grant only to service_role (called by Edge Functions).
REVOKE ALL ON FUNCTION public.get_user_id_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO service_role;

-- Ensure the auth.users email column is indexed (Supabase creates this by
-- default, but the statement below is idempotent and documents the dependency).
-- CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users (email);
-- (Commented out: Supabase manages auth schema indexes; this line is for docs only.)
