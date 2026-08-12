-- Migration: 20260811000000_weekly_digest_marketing_opt_out.sql
-- Description: Weekly digest (#2911) marketing opt-out and per-user unsubscribe tokens.
--
-- 1. Adds `receives_marketing_emails` (master marketing/digest switch) and
--    `unsubscribe_token` (opaque token authenticating the 1-click unsubscribe
--    link) to `user_preferences`.
-- 2. Extends `get_digest_subscribers()` to expose `user_id` + `unsubscribe_token`
--    and to strictly exclude users who opted out of marketing emails.
-- 3. Adds `set_marketing_opt_out(email, token)` used by the `digest-unsubscribe`
--    Edge Function.

-- 1. Marketing opt-out columns ----------------------------------------------
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS receives_marketing_emails BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT;

COMMENT ON COLUMN public.user_preferences.receives_marketing_emails IS
  'Master switch for marketing emails. The weekly digest cron strictly filters out users with this set to false.';
COMMENT ON COLUMN public.user_preferences.unsubscribe_token IS
  'Opaque per-user token used to authenticate the 1-click unsubscribe link. Issued by the weekly-digest function.';

-- 2. get_digest_subscribers() -----------------------------------------------
-- NOTE: prior migrations define get_digest_subscribers() as
-- RETURNS TABLE (email TEXT, full_name TEXT). PostgreSQL refuses to change the
-- return type of an existing function via CREATE OR REPLACE (ERROR 42P13), so
-- the old signature must be dropped before redefining it with the extra
-- columns. Grants are re-applied below.
DROP FUNCTION IF EXISTS public.get_digest_subscribers();

CREATE OR REPLACE FUNCTION public.get_digest_subscribers()
RETURNS TABLE (user_id UUID, email TEXT, full_name TEXT, unsubscribe_token TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(
      NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''),
      NULLIF(p.full_name, ''),
      'Student'
    )::TEXT,
    up.unsubscribe_token::TEXT
  FROM auth.users u
  LEFT JOIN public.profiles p ON u.id = p.id
  LEFT JOIN public.user_preferences up ON up.user_id = u.id
  WHERE (
        (u.raw_user_meta_data->>'newsletter_opt_in')::BOOLEAN = true
        OR (p.notification_preferences->>'digest')::BOOLEAN = true
  )
  AND COALESCE(up.receives_marketing_emails, true) = true
  AND u.email IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_digest_subscribers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_digest_subscribers() TO service_role;

-- 3. set_marketing_opt_out(email, token) -------------------------------------
CREATE OR REPLACE FUNCTION public.set_marketing_opt_out(p_email TEXT, p_token TEXT)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_token   TEXT;
BEGIN
  SELECT u.id, up.unsubscribe_token
    INTO v_user_id, v_token
  FROM auth.users u
  LEFT JOIN public.user_preferences up ON up.user_id = u.id
  WHERE LOWER(u.email) = LOWER(p_email);

  -- Unknown email or token mismatch: refuse to flip the flag.
  IF v_user_id IS NULL OR v_token IS NULL OR v_token IS DISTINCT FROM p_token THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_preferences (user_id, receives_marketing_emails)
  VALUES (v_user_id, false)
  ON CONFLICT (user_id)
  DO UPDATE SET receives_marketing_emails = false, updated_at = NOW();

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_marketing_opt_out(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_marketing_opt_out(TEXT, TEXT) TO service_role;
