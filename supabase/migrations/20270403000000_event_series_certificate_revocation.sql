-- Issue #4543: Automated Event Series Certificate Revocation.
-- Revocation is irreversible through the public client and is authorized by the
-- issuing club's event-management permission or a campus administrator.

ALTER TABLE public.verified_certificates
  ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_verified_certificates_revoked
  ON public.verified_certificates(series_id, is_revoked);

COMMENT ON COLUMN public.verified_certificates.is_revoked IS
  'Whether the issuing organization has invalidated this event-series credential.';
COMMENT ON COLUMN public.verified_certificates.revocation_reason IS
  'Plain-text reason shown to the credential holder and public verifier.';

CREATE OR REPLACE FUNCTION public.can_revoke_series_certificate(
  p_series_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_series es
    JOIN public.clubs c ON c.id = es.club_id
    WHERE es.id = p_series_id
      AND (
        c.created_by = p_user_id
        OR public.has_club_permission(es.club_id, p_user_id, 'events.create')
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = p_user_id
            AND p.role::TEXT IN ('admin', 'owner', 'system_admin')
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_issuer_series_certificates(
  p_series_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  series_id UUID,
  series_name TEXT,
  user_name TEXT,
  completion_date DATE,
  pdf_url TEXT,
  issued_at TIMESTAMPTZ,
  is_revoked BOOLEAN,
  revocation_reason TEXT,
  revoked_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    vc.id,
    vc.series_id,
    vc.series_name,
    vc.user_name,
    vc.completion_date,
    vc.pdf_url,
    vc.issued_at,
    vc.is_revoked,
    vc.revocation_reason,
    vc.revoked_at
  FROM public.verified_certificates vc
  WHERE (p_series_id IS NULL OR vc.series_id = p_series_id)
    AND public.can_revoke_series_certificate(vc.series_id, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.revoke_verified_series_certificate(
  p_certificate_id UUID,
  p_reason TEXT
)
RETURNS public.verified_certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_certificate public.verified_certificates;
  v_reason TEXT := NULLIF(TRIM(p_reason), '');
  v_updated BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to revoke a certificate.' USING ERRCODE = '42501';
  END IF;

  IF v_reason IS NULL OR char_length(v_reason) < 3 OR char_length(v_reason) > 1000 THEN
    RAISE EXCEPTION 'A revocation reason between 3 and 1000 characters is required.' USING ERRCODE = '22023';
  END IF;

  SELECT vc.*
    INTO v_certificate
  FROM public.verified_certificates vc
  WHERE vc.id = p_certificate_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Certificate not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.can_revoke_series_certificate(v_certificate.series_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the issuing organizer or an administrator can revoke this certificate.' USING ERRCODE = '42501';
  END IF;

  IF v_certificate.is_revoked THEN
    RETURN v_certificate;
  END IF;

  UPDATE public.verified_certificates
     SET is_revoked = TRUE,
         revocation_reason = v_reason,
         revoked_at = NOW(),
         revoked_by = auth.uid()
   WHERE id = p_certificate_id
   RETURNING * INTO v_certificate;

  v_updated := TRUE;

  IF v_updated THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_certificate.user_id,
      'certificate_revoked',
      'Certificate revoked',
      'Your event-series certificate "' || v_certificate.series_name || '" was revoked by the issuing organization. Reason: ' || v_reason,
      '/verify?hash=' || v_certificate.verification_hash
    );
  END IF;

  RETURN v_certificate;
END;
$$;

REVOKE ALL ON FUNCTION public.can_revoke_series_certificate(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_issuer_series_certificates(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_verified_series_certificate(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_revoke_series_certificate(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_issuer_series_certificates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_verified_series_certificate(UUID, TEXT) TO authenticated;
