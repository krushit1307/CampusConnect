-- ============================================================
-- Migration: Track individual device sessions for remote logout
-- Description: Adds `public.device_sessions` to track each
--              authenticated device session, links it to the
--              underlying Supabase auth session, and exposes a
--              service-role-only RPC to revoke the linked
--              `auth.sessions` / `auth.refresh_tokens` rows so a
--              revoked device's refresh token stops working.
-- ============================================================

-- 1. Device sessions table ---------------------------------------
-- NOTE: `public.user_sessions` already exists for DAU analytics, so
-- this feature uses `public.device_sessions`.
CREATE TABLE IF NOT EXISTS public.device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Maps 1:1 to the active Supabase auth session (auth.sessions.id).
  -- The access-token JWT exposes this id via its `session_id` claim.
  auth_session_id UUID NOT NULL UNIQUE,
  device_info TEXT,
  browser TEXT,
  os TEXT,
  ip_address INET,
  user_agent TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast path for the "Active Devices" dashboard.
CREATE INDEX IF NOT EXISTS idx_device_sessions_user_last_active
  ON public.device_sessions (user_id, last_active_at DESC);

-- 2. Row Level Security -------------------------------------------
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own device sessions" ON public.device_sessions;
CREATE POLICY "Users can view their own device sessions" ON public.device_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can revoke their own device sessions" ON public.device_sessions;
CREATE POLICY "Users can revoke their own device sessions" ON public.device_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Writes are performed by the `register-device-session` edge function
-- via service_role, so no INSERT/UPDATE policy is exposed to clients.

-- 3. Revoke the underlying Supabase auth session -------------------
-- Deleting `auth.refresh_tokens` + `auth.sessions` invalidates the
-- device's refresh token; the next token refresh is rejected and the
-- client is forced back to the login screen.
CREATE OR REPLACE FUNCTION public.revoke_auth_session(p_auth_session_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  DELETE FROM auth.refresh_tokens WHERE session_id = p_auth_session_id;
  DELETE FROM auth.sessions WHERE id = p_auth_session_id;
END;
$$;

-- Only the edge function (service_role) may call this RPC.
REVOKE ALL ON FUNCTION public.revoke_auth_session(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_auth_session(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.revoke_auth_session(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_auth_session(UUID) TO service_role;
