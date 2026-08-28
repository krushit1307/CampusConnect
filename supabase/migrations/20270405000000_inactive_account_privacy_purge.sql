-- =============================================================================
-- Migration: Automated Data Privacy Inactive Account Purge
-- Issue: #4528
--
-- Uses auth.users.last_sign_in_at as the authoritative login timestamp because
-- authentication activity is not reliably represented in public.profiles. The
-- existing anonymize_user_account() pipeline scrubs identity data while keeping
-- event_rsvps and financial history for aggregate/statistical integrity.
--
-- The purge is service-role/cron-only, idempotent, auditable, excludes alumni
-- and mentor identities, and supports a dry-run mode for operational review.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inactive_account_purge_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_sign_in_at TIMESTAMPTZ,
  account_created_at TIMESTAMPTZ NOT NULL,
  cutoff_at TIMESTAMPTZ NOT NULL,
  role_at_purge TEXT NOT NULL,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL CHECK (status IN ('identified', 'anonymized', 'failed')),
  result JSONB NOT NULL DEFAULT '{}'::JSONB,
  purged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, cutoff_at, dry_run)
);

CREATE INDEX IF NOT EXISTS idx_inactive_account_purge_audit_user
  ON public.inactive_account_purge_audit(user_id, purged_at DESC);

ALTER TABLE public.inactive_account_purge_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inactive_account_purge_audit FROM anon, authenticated;
GRANT ALL ON public.inactive_account_purge_audit TO service_role;

CREATE OR REPLACE FUNCTION public.execute_inactive_purge(
  p_dry_run BOOLEAN DEFAULT FALSE,
  p_inactivity_years INTEGER DEFAULT 4
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_examined INTEGER := 0;
  v_anonymized INTEGER := 0;
  v_failed INTEGER := 0;
  v_result JSONB;
  v_user RECORD;
  v_pipeline_result JSONB;
BEGIN
  IF current_user <> 'postgres'
     AND NOT pg_has_role(current_user, 'service_role', 'member') THEN
    RAISE EXCEPTION 'Inactive account purge is restricted to the service role.'
      USING ERRCODE = '42501';
  END IF;

  IF p_inactivity_years < 4 OR p_inactivity_years > 25 THEN
    RAISE EXCEPTION 'Inactivity threshold must be between 4 and 25 years.'
      USING ERRCODE = '22023';
  END IF;

  v_cutoff := NOW() - make_interval(years => p_inactivity_years);

  FOR v_user IN
    SELECT
      u.id,
      u.last_sign_in_at,
      u.created_at,
      p.role::TEXT AS profile_role
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE (
      u.last_sign_in_at < v_cutoff
      OR (u.last_sign_in_at IS NULL AND u.created_at < v_cutoff)
    )
      -- Current student accounts are represented by student/user. Alumni are
      -- intentionally excluded, including alumni mentors and transitioned users.
      AND LOWER(p.role::TEXT) IN ('student', 'user')
      AND NOT EXISTS (
        SELECT 1
        FROM public.inactive_account_purge_audit a
        WHERE a.user_id = u.id
          AND a.dry_run = FALSE
          AND a.status = 'anonymized'
      )
  LOOP
    v_examined := v_examined + 1;

    IF p_dry_run THEN
      INSERT INTO public.inactive_account_purge_audit (
        user_id,
        last_sign_in_at,
        account_created_at,
        cutoff_at,
        role_at_purge,
        dry_run,
        status,
        result
      ) VALUES (
        v_user.id,
        v_user.last_sign_in_at,
        v_user.created_at,
        v_cutoff,
        v_user.profile_role,
        TRUE,
        'identified',
        jsonb_build_object('action', 'would_anonymize')
      )
      ON CONFLICT (user_id, cutoff_at, dry_run) DO NOTHING;
      CONTINUE;
    END IF;

    BEGIN
      -- This pipeline deliberately preserves event_rsvps and ledger history.
      v_pipeline_result := public.anonymize_user_account(v_user.id);

      INSERT INTO public.inactive_account_purge_audit (
        user_id,
        last_sign_in_at,
        account_created_at,
        cutoff_at,
        role_at_purge,
        dry_run,
        status,
        result
      ) VALUES (
        v_user.id,
        v_user.last_sign_in_at,
        v_user.created_at,
        v_cutoff,
        v_user.profile_role,
        FALSE,
        'anonymized',
        COALESCE(v_pipeline_result, '{}'::JSONB)
      )
      ON CONFLICT (user_id, cutoff_at, dry_run) DO UPDATE
        SET status = EXCLUDED.status,
            result = EXCLUDED.result,
            purged_at = NOW();

      v_anonymized := v_anonymized + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      INSERT INTO public.inactive_account_purge_audit (
        user_id,
        last_sign_in_at,
        account_created_at,
        cutoff_at,
        role_at_purge,
        dry_run,
        status,
        result
      ) VALUES (
        v_user.id,
        v_user.last_sign_in_at,
        v_user.created_at,
        v_cutoff,
        v_user.profile_role,
        FALSE,
        'failed',
        jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
      )
      ON CONFLICT (user_id, cutoff_at, dry_run) DO UPDATE
        SET status = EXCLUDED.status,
            result = EXCLUDED.result,
            purged_at = NOW();
    END;
  END LOOP;

  v_result := jsonb_build_object(
    'success', (v_failed = 0),
    'dry_run', p_dry_run,
    'inactivity_years', p_inactivity_years,
    'cutoff_at', v_cutoff,
    'examined', v_examined,
    'anonymized', v_anonymized,
    'failed', v_failed,
    'historical_rsvps_preserved', TRUE
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.execute_inactive_purge(BOOLEAN, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_inactive_purge(BOOLEAN, INTEGER) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'execute-inactive-purge') THEN
      PERFORM cron.unschedule('execute-inactive-purge');
    END IF;

    PERFORM cron.schedule(
      'execute-inactive-purge',
      '0 4 * * *',
      'SELECT public.execute_inactive_purge(FALSE, 4);'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Inactive purge cron schedule was not created: %', SQLERRM;
END;
$$;

COMMENT ON TABLE public.inactive_account_purge_audit IS
  'Service-role audit trail for four-year inactive identity anonymization. Event RSVP and ledger history remain intact. Issue #4528.';

-- Extend the existing account anonymization pipeline with every profile PII
-- field currently present on this branch. Historical RSVPs and ledger rows are
-- intentionally not deleted or reassigned.
CREATE OR REPLACE FUNCTION public.anonymize_user_account(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_anonymized_email TEXT := 'deleted_user_' || target_user_id::TEXT || '@campusconnect.edu';
  v_retained_rsvps INTEGER := 0;
  v_retained_transactions INTEGER := 0;
  v_purged_messages INTEGER := 0;
  v_purged_media INTEGER := 0;
BEGIN
  UPDATE public.profiles
  SET full_name = 'Anonymous User',
      first_name = 'Anonymous',
      last_name = 'User',
      email = v_anonymized_email,
      avatar_url = NULL,
      avatar_theme = NULL,
      bio = NULL,
      handle = 'anonymous_' || SUBSTRING(target_user_id::TEXT, 1, 8),
      college = NULL,
      phone_number = NULL,
      preferred_currency = 'USD',
      linkedin_url = NULL,
      skills = NULL,
      course_codes = '{}',
      dietary_restrictions = NULL,
      notification_preferences = '{}'::JSONB,
      vendor_portfolio = '{}'::JSONB,
      public_key = NULL,
      updated_at = NOW()
  WHERE id = target_user_id;

  UPDATE auth.users
  SET email = v_anonymized_email,
      phone = NULL,
      raw_user_meta_data = jsonb_build_object('name', 'Anonymous User', 'anonymized', TRUE),
      updated_at = NOW()
  WHERE id = target_user_id;

  DELETE FROM public.direct_messages
  WHERE sender_id = target_user_id OR receiver_id = target_user_id;
  GET DIAGNOSTICS v_purged_messages = ROW_COUNT;

  DELETE FROM public.media_assets
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS v_purged_media = ROW_COUNT;

  SELECT COUNT(*) INTO v_retained_rsvps
  FROM public.event_rsvps
  WHERE user_id = target_user_id;

  SELECT COUNT(*) INTO v_retained_transactions
  FROM public.transactions
  WHERE created_by = target_user_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', target_user_id,
    'anonymized_email', v_anonymized_email,
    'purged_messages', v_purged_messages,
    'purged_media', v_purged_media,
    'retained_rsvps', v_retained_rsvps,
    'retained_transactions', v_retained_transactions,
    'anonymized_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_user_account(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_user_account(UUID) TO service_role;
