-- Issue #4262: Interactive Club Hierarchy Org Chart.
-- Reporting lines point to a member user rather than exposing private profile data.

ALTER TABLE public.club_roles
  ADD COLUMN IF NOT EXISTS reports_to_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_club_roles_reports_to_user
  ON public.club_roles (club_id, reports_to_user_id);

CREATE OR REPLACE FUNCTION public.validate_club_role_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reports_to_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = NEW.club_id
      AND cm.user_id = NEW.reports_to_user_id
      AND cm.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'A role can only report to an approved member of the same club';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_club_role_manager ON public.club_roles;
CREATE TRIGGER trg_validate_club_role_manager
BEFORE INSERT OR UPDATE OF club_id, reports_to_user_id ON public.club_roles
FOR EACH ROW EXECUTE FUNCTION public.validate_club_role_manager();

CREATE OR REPLACE FUNCTION public.set_club_role_manager(
  p_role_id UUID,
  p_reports_to_user_id UUID DEFAULT NULL
)
RETURNS public.club_roles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.club_roles;
  v_role_user_id UUID;
  v_current_user UUID := auth.uid();
BEGIN
  SELECT * INTO v_role FROM public.club_roles WHERE id = p_role_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found.' USING ERRCODE = 'P0002'; END IF;
  IF NOT (public.is_club_admin(v_role.club_id, v_current_user) OR public.is_system_admin()) THEN
    RAISE EXCEPTION 'Only club administrators can change reporting lines.' USING ERRCODE = '42501';
  END IF;

  SELECT cm.user_id INTO v_role_user_id
  FROM public.club_members cm
  WHERE cm.club_id = v_role.club_id AND cm.role_id = v_role.id AND cm.status = 'approved'
  ORDER BY cm.created_at ASC
  LIMIT 1;

  IF p_reports_to_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = v_role.club_id
      AND cm.user_id = p_reports_to_user_id
      AND cm.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'The manager must be an approved member of the same club.' USING ERRCODE = '22023';
  END IF;
  IF v_role_user_id IS NOT NULL AND p_reports_to_user_id = v_role_user_id THEN
    RAISE EXCEPTION 'A member cannot report to themselves.' USING ERRCODE = '22023';
  END IF;

  IF v_role_user_id IS NOT NULL AND p_reports_to_user_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE manager_chain(user_id, path) AS (
      SELECT p_reports_to_user_id, ARRAY[p_reports_to_user_id]::UUID[]
      UNION ALL
      SELECT parent_role.reports_to_user_id, manager_chain.path || parent_role.reports_to_user_id
      FROM manager_chain
      JOIN public.club_members parent_member
        ON parent_member.club_id = v_role.club_id
       AND parent_member.user_id = manager_chain.user_id
       AND parent_member.status = 'approved'
      JOIN public.club_roles parent_role ON parent_role.id = parent_member.role_id
      WHERE parent_role.reports_to_user_id IS NOT NULL
        AND NOT parent_role.reports_to_user_id = ANY(manager_chain.path)
    )
    SELECT 1 FROM manager_chain WHERE user_id = v_role_user_id
  ) THEN
    RAISE EXCEPTION 'Circular reporting line detected.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.club_roles
  SET reports_to_user_id = p_reports_to_user_id
  WHERE id = v_role.id
  RETURNING * INTO v_role;
  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_club_hierarchy(p_club_id UUID)
RETURNS TABLE (
  role_id UUID,
  user_id UUID,
  reports_to_user_id UUID,
  full_name TEXT,
  handle TEXT,
  avatar_url TEXT,
  role_title TEXT,
  department TEXT,
  depth INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE approved_members AS (
    SELECT
      cr.id AS role_id,
      cm.user_id,
      cr.reports_to_user_id,
      COALESCE(NULLIF(BTRIM(p.full_name), ''), 'Club member') AS full_name,
      COALESCE(p.handle, '') AS handle,
      p.avatar_url,
      COALESCE(NULLIF(BTRIM(cr.title), ''), 'Club member') AS role_title,
      NULL::TEXT AS department
    FROM public.club_members cm
    JOIN public.club_roles cr ON cr.id = cm.role_id AND cr.club_id = cm.club_id
    JOIN public.profiles p ON p.id = cm.user_id
    JOIN public.clubs c ON c.id = cm.club_id AND c.status = 'approved'
    WHERE cm.club_id = p_club_id
      AND cm.status = 'approved'
  ),
  hierarchy AS (
    SELECT am.*, 0 AS depth, ARRAY[am.user_id]::UUID[] AS path
    FROM approved_members am
    WHERE am.reports_to_user_id IS NULL
    UNION ALL
    SELECT child.*, parent.depth + 1, parent.path || child.user_id
    FROM approved_members child
    JOIN hierarchy parent ON child.reports_to_user_id = parent.user_id
    WHERE NOT child.user_id = ANY(parent.path)
  )
  SELECT h.role_id, h.user_id, h.reports_to_user_id, h.full_name, h.handle,
         h.avatar_url, h.role_title, h.department, h.depth
  FROM hierarchy h
  ORDER BY h.depth, h.role_title, h.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.set_club_role_manager(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_club_hierarchy(UUID) TO anon, authenticated;

COMMENT ON COLUMN public.club_roles.reports_to_user_id IS
  'Approved club member responsible for this role; used by the public organization chart.';
COMMENT ON FUNCTION public.get_public_club_hierarchy(UUID) IS
  'Returns a cycle-safe, public-safe hierarchy of approved club members without private contact fields.';
