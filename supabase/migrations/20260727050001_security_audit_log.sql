-- Migration: 20260727050000_security_audit_log.sql
-- Description: Create security_audit_log table, append-only triggers, and update write-capable SECURITY DEFINER functions to write to the log.

-- 1. Create security_audit_log table
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_name TEXT NOT NULL,
    action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Trigger function to raise exception on update or delete
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Updates or deletes on security_audit_log are not allowed.';
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger to enforce append-only constraint
DROP TRIGGER IF EXISTS enforce_immutable_audit_log ON public.security_audit_log;
CREATE TRIGGER enforce_immutable_audit_log
BEFORE UPDATE OR DELETE ON public.security_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_log_modification();

-- 4. Enable RLS on audit log and restrict view permissions
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view security audit logs" ON public.security_audit_log;
CREATE POLICY "Admins can view security audit logs"
ON public.security_audit_log
FOR SELECT
TO authenticated
USING (public.is_system_admin());


-- 5. Redefine security definer functions with logging enabled

-- A. Redefine secure_event_checkout
CREATE OR REPLACE FUNCTION public.secure_event_checkout(
    p_event_id UUID,
    p_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key INT;
  v_lock_acquired BOOLEAN;
  v_max_capacity INT;
  v_current_rsvps INT;
  v_requires_approval BOOLEAN;
  v_has_rsvped BOOLEAN;
BEGIN
  v_lock_key := ('x' || substr(md5(p_event_id::text), 1, 8))::bit(32)::int;

  SELECT pg_try_advisory_xact_lock(v_lock_key) INTO v_lock_acquired;

  IF NOT v_lock_acquired THEN
    RETURN 'BUSY';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.event_rsvps 
    WHERE event_id = p_event_id AND user_id = p_user_id
  ) INTO v_has_rsvped;

  IF v_has_rsvped THEN
    RETURN 'ALREADY_RSVPED';
  END IF;

  SELECT max_attendees, requires_approval
  INTO v_max_capacity, v_requires_approval
  FROM public.events
  WHERE id = p_event_id;

  SELECT COUNT(*)
  INTO v_current_rsvps
  FROM public.event_rsvps
  WHERE event_id = p_event_id;

  IF v_max_capacity IS NOT NULL AND v_current_rsvps >= v_max_capacity THEN
    RETURN 'FULL';
  END IF;

  -- Logging RLS Bypass
  INSERT INTO public.security_audit_log (function_name, action, target_table, target_id)
  VALUES ('secure_event_checkout', 'INSERT', 'event_rsvps', p_event_id);

  INSERT INTO public.event_rsvps (event_id, user_id, status)
  VALUES (
    p_event_id,
    p_user_id,
    CASE WHEN v_requires_approval = TRUE THEN 'PENDING' ELSE 'FREE' END
  );

  RETURN 'SUCCESS';
END;
$$;


-- B. Redefine merge_events
CREATE OR REPLACE FUNCTION public.merge_events(
    p_primary_event_id UUID,
    p_secondary_event_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_primary_club_id UUID;
    v_secondary_club_id UUID;
BEGIN
    SELECT club_id INTO v_primary_club_id
    FROM public.events
    WHERE id = p_primary_event_id;

    IF v_primary_club_id IS NULL THEN
        RAISE EXCEPTION 'Primary event % not found.', p_primary_event_id;
    END IF;

    SELECT club_id INTO v_secondary_club_id
    FROM public.events
    WHERE id = p_secondary_event_id;

    IF v_secondary_club_id IS NULL THEN
        RAISE EXCEPTION 'Secondary event % not found.', p_secondary_event_id;
    END IF;

    IF p_primary_event_id = p_secondary_event_id THEN
        RAISE EXCEPTION 'Cannot merge an event with itself.';
    END IF;

    -- Logging RLS Bypass
    INSERT INTO public.security_audit_log (function_name, action, target_table, target_id)
    VALUES ('merge_events', 'DELETE', 'events', p_secondary_event_id);

    INSERT INTO public.event_rsvps (event_id, user_id, club_id, checked_in, rsvp_at, status)
    SELECT p_primary_event_id, user_id, v_primary_club_id, checked_in, rsvp_at, status
    FROM public.event_rsvps
    WHERE event_id = p_secondary_event_id
    ON CONFLICT (event_id, user_id, club_id) DO NOTHING;

    DELETE FROM public.event_rsvps WHERE event_id = p_secondary_event_id;

    INSERT INTO public.event_waitlist (event_id, user_id, club_id, created_at)
    SELECT p_primary_event_id, user_id, v_primary_club_id, created_at
    FROM public.event_waitlist
    WHERE event_id = p_secondary_event_id
    ON CONFLICT (event_id, user_id, club_id) DO NOTHING;

    DELETE FROM public.event_waitlist WHERE event_id = p_secondary_event_id;

    INSERT INTO public.saved_events (event_id, user_id, club_id, saved_at)
    SELECT p_primary_event_id, user_id, v_primary_club_id, saved_at
    FROM public.saved_events
    WHERE event_id = p_secondary_event_id
    ON CONFLICT (event_id, user_id, club_id) DO NOTHING;

    DELETE FROM public.saved_events WHERE event_id = p_secondary_event_id;

    INSERT INTO public.event_feedbacks (event_id, user_id, rating, comment, created_at)
    SELECT p_primary_event_id, user_id, rating, comment, created_at
    FROM public.event_feedbacks
    WHERE event_id = p_secondary_event_id
    ON CONFLICT (event_id, user_id) DO NOTHING;

    DELETE FROM public.event_feedbacks WHERE event_id = p_secondary_event_id;

    INSERT INTO public.event_co_hosts (event_id, club_id, created_at)
    SELECT p_primary_event_id, club_id, created_at
    FROM public.event_co_hosts
    WHERE event_id = p_secondary_event_id
    ON CONFLICT (event_id, club_id) DO NOTHING;

    DELETE FROM public.event_co_hosts WHERE event_id = p_secondary_event_id;

    INSERT INTO public.event_cohosts (event_id, user_id, created_at)
    SELECT p_primary_event_id, user_id, created_at
    FROM public.event_cohosts
    WHERE event_id = p_secondary_event_id
    ON CONFLICT (event_id, user_id) DO NOTHING;

    DELETE FROM public.event_cohosts WHERE event_id = p_secondary_event_id;

    UPDATE public.certificates
    SET event_id = p_primary_event_id, club_id = v_primary_club_id
    WHERE event_id = p_secondary_event_id;

    UPDATE public.polls
    SET event_id = p_primary_event_id
    WHERE event_id = p_secondary_event_id;

    UPDATE public.event_resources
    SET event_id = p_primary_event_id
    WHERE event_id = p_secondary_event_id;

    UPDATE public.event_photos
    SET event_id = p_primary_event_id
    WHERE event_id = p_secondary_event_id;

    DELETE FROM public.events
    WHERE id = p_secondary_event_id;

END;
$$;


-- C. Redefine safe_rsvp
CREATE OR REPLACE FUNCTION public.safe_rsvp(
  target_event_id UUID,
  target_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_attendees INTEGER;
  v_current_count INTEGER;
  v_club_id UUID;
BEGIN
  SELECT max_attendees, club_id
  INTO v_max_attendees, v_club_id
  FROM public.events
  WHERE id = target_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_rsvps
    WHERE event_id = target_event_id AND user_id = target_user_id
  ) THEN
    RETURN 'rsvp';
  END IF;

  SELECT COUNT(*)
  INTO v_current_count
  FROM public.event_rsvps
  WHERE event_id = target_event_id;

  IF v_max_attendees IS NULL OR v_current_count < v_max_attendees THEN
    DELETE FROM public.event_waitlist
    WHERE event_id = target_event_id AND user_id = target_user_id;

    -- Logging RLS Bypass
    INSERT INTO public.security_audit_log (function_name, action, target_table, target_id)
    VALUES ('safe_rsvp', 'INSERT', 'event_rsvps', target_event_id);

    INSERT INTO public.event_rsvps (event_id, user_id)
    VALUES (target_event_id, target_user_id)
    ON CONFLICT (event_id, user_id) DO NOTHING;

    RETURN 'rsvp';
  ELSE
    -- Logging RLS Bypass
    INSERT INTO public.security_audit_log (function_name, action, target_table, target_id)
    VALUES ('safe_rsvp', 'INSERT', 'event_waitlist', target_event_id);

    INSERT INTO public.event_waitlist (event_id, user_id)
    VALUES (target_event_id, target_user_id)
    ON CONFLICT (event_id, user_id) DO NOTHING;

    RETURN 'waitlist';
  END IF;
END;
$$;


-- D. Redefine increment_event_version_vector
CREATE OR REPLACE FUNCTION public.increment_event_version_vector(
  p_event_id UUID,
  p_client_id TEXT,
  p_new_version INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_vector JSONB;
  v_updated_vector JSONB;
  v_current_seq INT;
BEGIN
  SELECT version_vector INTO v_current_vector
  FROM public.events
  WHERE id = p_event_id;

  IF v_current_vector IS NULL THEN
    v_current_vector := '{}'::jsonb;
  END IF;

  v_current_seq := COALESCE((v_current_vector ->> p_client_id)::INT, 0) + 1;
  v_updated_vector := jsonb_set(v_current_vector, ARRAY[p_client_id], to_jsonb(v_current_seq));

  -- Logging RLS Bypass
  INSERT INTO public.security_audit_log (function_name, action, target_table, target_id)
  VALUES ('increment_event_version_vector', 'UPDATE', 'events', p_event_id);

  UPDATE public.events
  SET 
    version_vector = v_updated_vector,
    version = COALESCE(p_new_version, version + 1),
    updated_at = NOW()
  WHERE id = p_event_id;

  RETURN v_updated_vector;
END;
$$;
