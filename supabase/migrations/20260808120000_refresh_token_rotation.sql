-- ============================================================
-- Migration: Refresh Token Rotation & Theft Detection
-- Description: Adds `public.refresh_tokens` to track active/revoked
--              refresh tokens, and implements atomic rotation with
--              a 5-second grace period for concurrent requests and
--              active user lockout on stolen token reuse.
-- ============================================================

-- 1. Refresh Tokens table ---------------------------------------
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash
  ON public.refresh_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
  ON public.refresh_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_revoked
  ON public.refresh_tokens (user_id, is_revoked);

-- 2. Row Level Security -------------------------------------------
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own refresh tokens" ON public.refresh_tokens;
CREATE POLICY "Users can view their own refresh tokens" ON public.refresh_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Direct client updates/inserts are blocked; rotation must use the RPC.

-- 3. Atomic Refresh Token Rotation RPC -----------------------------
CREATE OR REPLACE FUNCTION public.rotate_refresh_token(
  p_token_hash TEXT,
  p_new_token_hash TEXT,
  p_grace_period_seconds INT DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_rec RECORD;
  v_new_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_revoked_duration INTERVAL;
BEGIN
  -- Row lock candidate token FOR UPDATE to ensure concurrency safety
  SELECT id, user_id, is_revoked, created_at, revoked_at
  INTO v_rec
  FROM public.refresh_tokens
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  -- Case 1: Token does not exist
  IF v_rec IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'invalid',
      'message', 'Invalid or non-existent refresh token'
    );
  END IF;

  -- Case 2: Token is active (is_revoked = false) -> Valid rotation
  IF v_rec.is_revoked = FALSE THEN
    -- Mark current token as revoked
    UPDATE public.refresh_tokens
    SET is_revoked = TRUE,
        revoked_at = v_now
    WHERE id = v_rec.id;

    -- Store new refresh token hash
    INSERT INTO public.refresh_tokens (user_id, token_hash, is_revoked, created_at)
    VALUES (v_rec.user_id, p_new_token_hash, FALSE, v_now)
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
      'status', 'success',
      'user_id', v_rec.user_id,
      'new_token_id', v_new_id
    );
  END IF;

  -- Case 3: Token is already revoked -> Check 5-second grace period
  v_revoked_duration := v_now - v_rec.revoked_at;

  IF v_rec.revoked_at IS NOT NULL AND v_revoked_duration <= (p_grace_period_seconds || ' seconds')::INTERVAL THEN
    -- Grace period active: Simultaneous multi-tab requests allowed without security lockout
    RETURN jsonb_build_object(
      'status', 'grace_period',
      'user_id', v_rec.user_id,
      'message', 'Token recently rotated within grace period'
    );
  ELSE
    -- REUSE / THEFT DETECTED!
    -- Revoke ALL active refresh tokens for this user immediately
    UPDATE public.refresh_tokens
    SET is_revoked = TRUE,
        revoked_at = v_now
    WHERE user_id = v_rec.user_id AND is_revoked = FALSE;

    RETURN jsonb_build_object(
      'status', 'revoked_all',
      'user_id', v_rec.user_id,
      'message', 'Security breach detected: Stolen refresh token reused. All user tokens revoked.'
    );
  END IF;
END;
$$;

-- Grant permissions for rotation function
GRANT EXECUTE ON FUNCTION public.rotate_refresh_token(TEXT, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.rotate_refresh_token(TEXT, TEXT, INT) TO authenticated;

-- 4. Helper RPC: Revoke all refresh tokens for a user ----------------
CREATE OR REPLACE FUNCTION public.revoke_all_user_refresh_tokens(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.refresh_tokens
  SET is_revoked = TRUE,
      revoked_at = NOW()
  WHERE user_id = p_user_id AND is_revoked = FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_all_user_refresh_tokens(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_all_user_refresh_tokens(UUID) TO authenticated;
