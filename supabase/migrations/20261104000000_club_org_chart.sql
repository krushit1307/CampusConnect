-- Interactive Club Org Chart (#3244)

ALTER TABLE public.club_roles
  ADD COLUMN IF NOT EXISTS reports_to_role_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'club_roles_reports_to_role_id_fkey'
  ) THEN
    ALTER TABLE public.club_roles
      ADD CONSTRAINT club_roles_reports_to_role_id_fkey
      FOREIGN KEY (reports_to_role_id) REFERENCES public.club_roles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_club_roles_reports_to_role
  ON public.club_roles (club_id, reports_to_role_id);

-- A role may only report to another role in the same club.
CREATE OR REPLACE FUNCTION public.validate_club_role_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reports_to_role_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.club_roles parent
    WHERE parent.id = NEW.reports_to_role_id
      AND parent.club_id = NEW.club_id
  ) THEN
    RAISE EXCEPTION 'A club role can only report to a role in the same club';
  END IF;
  IF NEW.reports_to_role_id = NEW.id THEN
    RAISE EXCEPTION 'A club role cannot report to itself';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_club_role_parent ON public.club_roles;
CREATE TRIGGER trg_validate_club_role_parent
BEFORE INSERT OR UPDATE OF club_id, reports_to_role_id ON public.club_roles
FOR EACH ROW EXECUTE FUNCTION public.validate_club_role_parent();

COMMENT ON COLUMN public.club_roles.reports_to_role_id IS
  'Optional parent role used to render the club organization chart.';
