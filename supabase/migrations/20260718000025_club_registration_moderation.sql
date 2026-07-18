-- ============================================================
-- Issue #60: Admin club registration approval workflow
-- ============================================================

DO $$
BEGIN
  CREATE TYPE public.club_approval_status AS ENUM (
    'pending',
    'approved',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Existing clubs remain visible. New clubs created after this migration
-- enter the moderation queue by default.
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS status public.club_approval_status;

UPDATE public.clubs
SET status = 'approved'::public.club_approval_status
WHERE status IS NULL;

ALTER TABLE public.clubs
  ALTER COLUMN status SET DEFAULT 'pending'::public.club_approval_status,
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS clubs_status_created_at_idx
  ON public.clubs (status, created_at DESC);

-- Public users only see approved clubs. Creators can still see their own
-- submission, and system administrators can review every status.
DROP POLICY IF EXISTS "Clubs are viewable by everyone." ON public.clubs;
DROP POLICY IF EXISTS "Approved clubs are publicly viewable." ON public.clubs;

CREATE POLICY "Approved clubs are publicly viewable."
ON public.clubs
FOR SELECT
USING (
  status = 'approved'::public.club_approval_status
  OR created_by = auth.uid()
  OR public.is_system_admin()
);

-- Creators and club admins may edit ordinary club information, but status
-- transitions are guarded by the trigger below.
DROP POLICY IF EXISTS "System admins can moderate clubs." ON public.clubs;
CREATE POLICY "System admins can moderate clubs."
ON public.clubs
FOR UPDATE
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

CREATE OR REPLACE FUNCTION public.guard_club_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     AND NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'Only system administrators can change club approval status.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_club_status_change ON public.clubs;
CREATE TRIGGER guard_club_status_change
BEFORE UPDATE OF status ON public.clubs
FOR EACH ROW
EXECUTE FUNCTION public.guard_club_status_change();

-- The frontend calls this RPC instead of directly updating the status column.
CREATE OR REPLACE FUNCTION public.moderate_club_registration(
  p_club_id UUID,
  p_status public.club_approval_status
)
RETURNS public.clubs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_club public.clubs;
BEGIN
  IF NOT public.is_system_admin() THEN
    RAISE EXCEPTION 'System administrator access is required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN (
    'approved'::public.club_approval_status,
    'rejected'::public.club_approval_status
  ) THEN
    RAISE EXCEPTION 'A pending club can only be approved or rejected.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.clubs
  SET
    status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_club_id
    AND status = 'pending'::public.club_approval_status
  RETURNING * INTO updated_club;

  IF updated_club.id IS NULL THEN
    RAISE EXCEPTION 'Pending club registration was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN updated_club;
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_club_registration(
  UUID,
  public.club_approval_status
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.moderate_club_registration(
  UUID,
  public.club_approval_status
) TO authenticated;
