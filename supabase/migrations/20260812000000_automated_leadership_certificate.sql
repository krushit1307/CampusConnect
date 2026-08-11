-- ============================================================
-- Migration: Automated Certificate of Leadership (#3011)
-- Description:
--  1. Adds removed_at and termination_reason columns to public.club_members
--  2. Adds constraint enforcing valid termination_reason values including 'impeached'
--  3. Extends public.certificates table with leadership metadata fields
--  4. Enforces strict backend 90-day minimum tenure requirement and impeachment exclusion
--  5. Adds PL/pgSQL eligibility and issuance functions with async Edge Function trigger
--  6. Preserves all existing RBAC functions (is_club_admin) and policies
-- ============================================================

-- 1. Alter public.club_members table to add removed_at and termination_reason
ALTER TABLE public.club_members 
ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

ALTER TABLE public.club_members 
ADD COLUMN IF NOT EXISTS termination_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_club_members_termination_reason'
  ) THEN
    ALTER TABLE public.club_members 
    ADD CONSTRAINT chk_club_members_termination_reason 
    CHECK (
      termination_reason IS NULL OR 
      termination_reason IN ('term_completed', 'resigned', 'impeached', 'removed', 'role_changed')
    );
  END IF;
END $$;

COMMENT ON COLUMN public.club_members.removed_at IS 
'Timestamp when the club member role/membership was ended or terminated.';

COMMENT ON COLUMN public.club_members.termination_reason IS 
'Reason for membership/role termination (term_completed, resigned, impeached, removed, role_changed).';

-- Indexes for efficient member role lookup
CREATE INDEX IF NOT EXISTS idx_club_members_user_status 
ON public.club_members (user_id, status);

CREATE INDEX IF NOT EXISTS idx_club_members_club_user 
ON public.club_members (club_id, user_id);

-- 2. Alter public.certificates table to add leadership certificate metadata
ALTER TABLE public.certificates 
ADD COLUMN IF NOT EXISTS certificate_type TEXT NOT NULL DEFAULT 'attendance';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_certificates_type'
  ) THEN
    ALTER TABLE public.certificates 
    ADD CONSTRAINT chk_certificates_type 
    CHECK (certificate_type IN ('attendance', 'leadership'));
  END IF;
END $$;

ALTER TABLE public.certificates 
ADD COLUMN IF NOT EXISTS role_title TEXT;

ALTER TABLE public.certificates 
ADD COLUMN IF NOT EXISTS tenure_start TIMESTAMPTZ;

ALTER TABLE public.certificates 
ADD COLUMN IF NOT EXISTS tenure_end TIMESTAMPTZ;

ALTER TABLE public.certificates 
ADD COLUMN IF NOT EXISTS termination_reason TEXT;

COMMENT ON COLUMN public.certificates.certificate_type IS 
'Type of certificate issued (attendance vs leadership).';

COMMENT ON COLUMN public.certificates.role_title IS 
'Snapshotted leadership role title at certificate issuance time.';

COMMENT ON COLUMN public.certificates.tenure_start IS 
'Snapshotted tenure start timestamp.';

COMMENT ON COLUMN public.certificates.tenure_end IS 
'Snapshotted tenure end timestamp.';

COMMENT ON COLUMN public.certificates.termination_reason IS 
'Snapshotted termination reason for leadership certificates.';

-- Unique constraint for leadership certificates to prevent duplicate issuance per role tenure
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_leadership_certificate 
ON public.certificates (club_id, user_id, role_title, tenure_start) 
WHERE certificate_type = 'leadership';


-- 3. PL/pgSQL Function: Check Leadership Certificate Eligibility (Backend Logic Enforcement)
CREATE OR REPLACE FUNCTION public.check_leadership_certificate_eligibility(p_member_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_club_id UUID;
  v_role_id UUID;
  v_status TEXT;
  v_joined_at TIMESTAMPTZ;
  v_created_at TIMESTAMPTZ;
  v_removed_at TIMESTAMPTZ;
  v_term_reason TEXT;
  v_role_title TEXT;
  v_permissions_level INT;
  v_tenure_start TIMESTAMPTZ;
  v_tenure_end TIMESTAMPTZ;
  v_tenure_days INT;
BEGIN
  -- Fetch member record
  SELECT cm.user_id, cm.club_id, cm.role_id, cm.status, cm.joined_at, cm.created_at, cm.removed_at, cm.termination_reason,
         cr.title, cr.permissions_level
  INTO v_user_id, v_club_id, v_role_id, v_status, v_joined_at, v_created_at, v_removed_at, v_term_reason,
       v_role_title, v_permissions_level
  FROM public.club_members cm
  JOIN public.club_roles cr ON cm.role_id = cr.id AND cm.club_id = cr.club_id
  WHERE cm.id = p_member_id;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Club member record not found'
    );
  END IF;

  -- Requirement: Impeached members are explicitly ineligible
  IF v_term_reason IS NOT NULL AND LOWER(v_term_reason) = 'impeached' THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Member was impeached and is ineligible for a leadership certificate',
      'termination_reason', v_term_reason
    );
  END IF;

  -- Requirement: Must be a leadership role (permissions_level >= 50 or title != 'Member')
  IF LOWER(v_role_title) = 'member' AND COALESCE(v_permissions_level, 0) < 50 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Member did not hold a leadership role',
      'role_title', v_role_title
    );
  END IF;

  -- Requirement: Backend 90-day minimum tenure enforcement
  v_tenure_start := COALESCE(v_joined_at, v_created_at);
  v_tenure_end := COALESCE(v_removed_at, NOW());

  IF v_tenure_start IS NULL THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Tenure start date is missing'
    );
  END IF;

  v_tenure_days := EXTRACT(DAY FROM (v_tenure_end - v_tenure_start))::INT;

  IF v_tenure_days < 90 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', format('Tenure must be at least 90 days (current tenure: %s days)', v_tenure_days),
      'tenure_days', v_tenure_days,
      'required_days', 90
    );
  END IF;

  -- Member passes all eligibility checks
  RETURN jsonb_build_object(
    'eligible', true,
    'reason', 'Eligible for leadership certificate',
    'user_id', v_user_id,
    'club_id', v_club_id,
    'role_title', v_role_title,
    'tenure_start', v_tenure_start,
    'tenure_end', v_tenure_end,
    'tenure_days', v_tenure_days,
    'termination_reason', v_term_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.check_leadership_certificate_eligibility(UUID) IS 
'Backend logic to validate if a member meets leadership role, non-impeached status, and 90-day minimum tenure requirements.';


-- 4. PL/pgSQL Function: Issue Leadership Certificate
CREATE OR REPLACE FUNCTION public.issue_leadership_certificate(p_member_id UUID)
RETURNS UUID AS $$
DECLARE
  v_eligibility JSONB;
  v_is_eligible BOOLEAN;
  v_ineligible_reason TEXT;
  v_user_id UUID;
  v_club_id UUID;
  v_role_title TEXT;
  v_tenure_start TIMESTAMPTZ;
  v_tenure_end TIMESTAMPTZ;
  v_term_reason TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_attendee_name TEXT;
  v_club_name TEXT;
  v_cert_id UUID;
  v_function_url TEXT := 'http://localhost:54321/functions/v1/generate-leadership-certs';
  v_payload JSONB;
BEGIN
  -- 1. Perform backend eligibility check
  v_eligibility := public.check_leadership_certificate_eligibility(p_member_id);
  v_is_eligible := (v_eligibility->>'eligible')::BOOLEAN;

  IF NOT v_is_eligible THEN
    v_ineligible_reason := v_eligibility->>'reason';
    RAISE EXCEPTION 'Leadership Certificate Ineligible: %', v_ineligible_reason;
  END IF;

  v_user_id := (v_eligibility->>'user_id')::UUID;
  v_club_id := (v_eligibility->>'club_id')::UUID;
  v_role_title := v_eligibility->>'role_title';
  v_tenure_start := (v_eligibility->>'tenure_start')::TIMESTAMPTZ;
  v_tenure_end := (v_eligibility->>'tenure_end')::TIMESTAMPTZ;
  v_term_reason := v_eligibility->>'termination_reason';

  -- 2. Snapshot member recipient name and club name
  SELECT first_name, last_name
  INTO v_first_name, v_last_name
  FROM public.profiles
  WHERE id = v_user_id;

  v_attendee_name := TRIM(CONCAT(COALESCE(v_first_name, ''), ' ', COALESCE(v_last_name, '')));
  IF v_attendee_name IS NULL OR v_attendee_name = '' THEN
    v_attendee_name := 'Student Leader';
  END IF;

  SELECT name INTO v_club_name
  FROM public.clubs
  WHERE id = v_club_id;

  -- 3. Insert certificate row with status 'pending' (Idempotent via unique index)
  INSERT INTO public.certificates (
    club_id,
    user_id,
    attendee_name,
    event_title,
    certificate_type,
    role_title,
    tenure_start,
    tenure_end,
    termination_reason,
    certificate_url
  )
  VALUES (
    v_club_id,
    v_user_id,
    v_attendee_name,
    CONCAT('Certificate of Leadership - ', COALESCE(v_role_title, 'Officer'), ' (', COALESCE(v_club_name, 'Club'), ')'),
    'leadership',
    v_role_title,
    v_tenure_start,
    v_tenure_end,
    v_term_reason,
    'pending'
  )
  ON CONFLICT (club_id, user_id, role_title, tenure_start) WHERE certificate_type = 'leadership'
  DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_cert_id;

  -- If returning is empty due to existing unchanged row, fetch existing cert ID
  IF v_cert_id IS NULL THEN
    SELECT id INTO v_cert_id
    FROM public.certificates
    WHERE club_id = v_club_id 
      AND user_id = v_user_id 
      AND role_title = v_role_title 
      AND tenure_start = v_tenure_start 
      AND certificate_type = 'leadership';
  END IF;

  -- 4. Dispatch async webhook to Edge Function via pg_net
  v_payload := jsonb_build_object(
    'certificate_id', v_cert_id,
    'member_id', p_member_id,
    'user_id', v_user_id,
    'club_id', v_club_id,
    'certificate_type', 'leadership'
  );

  BEGIN
    IF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE p.proname = 'http_post' AND n.nspname = 'net'
    ) THEN
      PERFORM net.http_post(
        url := v_function_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := v_payload
      );
    ELSIF EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE p.proname = 'http_post' AND n.nspname = 'extensions'
    ) THEN
      PERFORM extensions.http_post(
        url := v_function_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := v_payload
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Gracefully swallow webhook dispatch errors to prevent breaking the calling transaction
    NULL;
  END;

  RETURN v_cert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.issue_leadership_certificate(UUID) IS 
'Enforces backend eligibility (including 90-day tenure & non-impeachment) and issues a Leadership Certificate.';


-- 5. Trigger: Auto-issue Leadership Certificate on Role Termination
CREATE OR REPLACE FUNCTION public.on_club_member_terminated()
RETURNS TRIGGER AS $$
DECLARE
  v_eligibility JSONB;
BEGIN
  -- Automatically evaluate leadership certificate issuance when:
  --  1. removed_at is populated, or
  --  2. status changes from approved to removed/rejected
  IF (OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL) OR 
     (OLD.status = 'approved' AND NEW.status IN ('rejected', 'removed')) THEN
    
    -- Check eligibility silently without throwing exception to avoid blocking status update
    v_eligibility := public.check_leadership_certificate_eligibility(NEW.id);
    IF (v_eligibility->>'eligible')::BOOLEAN IS TRUE THEN
      PERFORM public.issue_leadership_certificate(NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_club_member_terminated ON public.club_members;

CREATE TRIGGER trg_on_club_member_terminated
AFTER UPDATE ON public.club_members
FOR EACH ROW
EXECUTE FUNCTION public.on_club_member_terminated();


-- 6. RPC Function: generate_leadership_certificate(p_user_id UUID, p_club_id UUID)
CREATE OR REPLACE FUNCTION public.generate_leadership_certificate(p_user_id UUID, p_club_id UUID)
RETURNS UUID AS $$
DECLARE
  v_member_id UUID;
  v_cert_id UUID;
BEGIN
  -- Fetch the user's club_member record for the specified club
  SELECT id INTO v_member_id
  FROM public.club_members
  WHERE user_id = p_user_id AND club_id = p_club_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'No membership record found for user % and club %', p_user_id, p_club_id;
  END IF;

  -- Issue leadership certificate (enforces backend eligibility, tenure >= 90 days, non-impeachment)
  v_cert_id := public.issue_leadership_certificate(v_member_id);

  RETURN v_cert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.generate_leadership_certificate(UUID, UUID) IS 
'RPC function to generate a Leadership Certificate for a given user and club after validating backend tenure and eligibility.';

