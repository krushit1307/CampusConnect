-- Issue #4296: Dynamic Mental Health Peer Support Matcher.
-- Only listener verification metadata is persisted. Waiting-room and chat
-- payloads are Supabase Realtime broadcasts and are never inserted into tables.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'peer_listener';

CREATE TABLE IF NOT EXISTS public.peer_listener_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  major TEXT NOT NULL,
  academic_year INTEGER NOT NULL CHECK (academic_year BETWEEN 3 AND 8),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'suspended')),
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (BTRIM(major) <> '')
);

CREATE INDEX IF NOT EXISTS idx_peer_listener_verifications_available
  ON public.peer_listener_verifications(status, academic_year);

ALTER TABLE public.peer_listener_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.peer_listener_verifications FROM anon, authenticated;
GRANT ALL ON public.peer_listener_verifications TO service_role;

CREATE POLICY "Users can view their own listener verification"
  ON public.peer_listener_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System admins manage listener verification"
  ON public.peer_listener_verifications FOR ALL TO authenticated
  USING (public.is_system_admin())
  WITH CHECK (public.is_system_admin());

CREATE OR REPLACE FUNCTION public.is_peer_listener()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.peer_listener_verifications v ON v.user_id = p.id
    WHERE p.id = auth.uid()
      AND p.role::TEXT = 'peer_listener'
      AND v.status = 'verified'
      AND v.academic_year >= 3
      AND POSITION('psychology' IN LOWER(v.major)) > 0
  );
$$;

CREATE OR REPLACE FUNCTION public.grant_peer_listener_role(
  p_user_id UUID,
  p_major TEXT,
  p_academic_year INTEGER
)
RETURNS public.peer_listener_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verification public.peer_listener_verifications;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'System administrator access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL
     OR POSITION('psychology' IN LOWER(COALESCE(p_major, ''))) = 0
     OR p_academic_year < 3 THEN
    RAISE EXCEPTION 'A verified psychology major in their third year or above is required.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.peer_listener_verifications (
    user_id, major, academic_year, status, verified_by, verified_at, updated_at
  ) VALUES (
    p_user_id, BTRIM(p_major), p_academic_year, 'verified', auth.uid(), NOW(), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET major = EXCLUDED.major,
        academic_year = EXCLUDED.academic_year,
        status = 'verified',
        verified_by = EXCLUDED.verified_by,
        verified_at = EXCLUDED.verified_at,
        updated_at = NOW()
  RETURNING * INTO v_verification;

  UPDATE public.profiles
  SET role = 'peer_listener'::public.user_role, updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_verification;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_peer_listener_role(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'System administrator access is required.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.peer_listener_verifications
  SET status = 'suspended', updated_at = NOW()
  WHERE user_id = p_user_id;
  UPDATE public.profiles
  SET role = 'student'::public.user_role, updated_at = NOW()
  WHERE id = p_user_id AND role::TEXT = 'peer_listener';
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_peer_listener() TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_peer_listener_role(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_peer_listener_role(UUID) TO authenticated;

-- Realtime carries only opaque session IDs and browser-encrypted ciphertext. No
-- waiting-room or chat rows are stored in the database.
CREATE POLICY "Authenticated users can use peer support realtime"
  ON realtime.messages FOR ALL TO authenticated
  USING ((SELECT realtime.topic()) LIKE 'peer-support:%')
  WITH CHECK ((SELECT realtime.topic()) LIKE 'peer-support:%');

COMMENT ON TABLE public.peer_listener_verifications IS
  'Admin-managed listener eligibility metadata. No waiting-room or chat content is stored here.';
