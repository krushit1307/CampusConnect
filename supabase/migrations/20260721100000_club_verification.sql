-- Issue #601: Add is_verified boolean to clubs for official university clubs
-- Only system admins may set is_verified to TRUE; regular club admin inserts
-- and updates must not be able to change this column.

-- 1. Add the column
ALTER TABLE clubs
  ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Guard trigger: prevent is_verified from being set/changed by anyone
--    other than a system admin (RLS alone can't restrict a single column,
--    and it doesn't cover INSERT column-level restrictions either).
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_club_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_verified = true AND NOT public.is_system_admin() THEN
      RAISE EXCEPTION 'Only system admins can set club verification status.';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
      IF NOT public.is_system_admin() THEN
        RAISE EXCEPTION 'Only system admins can change club verification status.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_unauthorized_club_verification
BEFORE INSERT OR UPDATE ON clubs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unauthorized_club_verification();