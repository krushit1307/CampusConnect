-- Role-Based Data Access Enforcement (#5223)
--
-- Central authorization policy used by server-side operations.
-- The policy always reads current database state, so role changes
-- take effect without requiring a new client session.

CREATE OR REPLACE FUNCTION public.authorize_resource_action(
  p_resource_type TEXT,
  p_resource_id UUID,
  p_operation TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_club_id UUID;
  v_event_creator UUID;
  v_club_creator UUID;
  v_profile_role TEXT;
BEGIN
  IF p_user_id IS NULL OR p_resource_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Always read the current profile role from the database.
  SELECT role::TEXT
  INTO v_profile_role
  FROM public.profiles
  WHERE id = p_user_id;

  -- University/system administrators can perform protected
  -- administrative operations.
  IF v_profile_role = 'system_admin' THEN
    RETURN TRUE;
  END IF;

  -- Global RBAC permission is also accepted.
  IF public.has_permission(
    p_user_id,
    CASE
      WHEN p_operation IN ('create_event', 'update_event', 'delete_event', 'cancel_event')
        THEN 'events.' || CASE
          WHEN p_operation = 'create_event' THEN 'create'
          WHEN p_operation = 'update_event' THEN 'update'
          ELSE 'delete'
        END
      WHEN p_operation = 'update_club' THEN 'clubs.update'
      WHEN p_operation = 'delete_club' THEN 'clubs.delete'
      WHEN p_operation = 'manage_members' THEN 'members.manage'
      WHEN p_operation = 'manage_roles' THEN 'roles.manage'
      ELSE ''
    END
  ) THEN
    RETURN TRUE;
  END IF;

  -- ----------------------------------------------------------
  -- Club-level authorization
  -- ----------------------------------------------------------
  IF p_resource_type = 'club' THEN
    SELECT created_by
    INTO v_club_creator
    FROM public.clubs
    WHERE id = p_resource_id;

    IF NOT FOUND THEN
      RETURN FALSE;
    END IF;

    -- Resource ownership is checked independently of UI state.
    IF v_club_creator = p_user_id
       AND p_operation IN ('update_club', 'manage_members', 'manage_roles') THEN
      RETURN TRUE;
    END IF;

    IF p_operation IN ('update_club', 'manage_members', 'manage_roles') THEN
      RETURN public.is_club_admin(p_resource_id, p_user_id);
    END IF;

    IF p_operation = 'delete_club' THEN
      RETURN FALSE;
    END IF;

    RETURN FALSE;
  END IF;

  -- ----------------------------------------------------------
  -- Event-level authorization
  -- ----------------------------------------------------------
  IF p_resource_type = 'event' THEN
    SELECT
      e.club_id,
      e.created_by
    INTO
      v_club_id,
      v_event_creator
    FROM public.events e
    WHERE e.id = p_resource_id;

    IF NOT FOUND THEN
      RETURN FALSE;
    END IF;

    -- Event ownership.
    IF v_event_creator = p_user_id
       AND p_operation IN ('update_event', 'delete_event', 'cancel_event') THEN
      RETURN TRUE;
    END IF;

    -- Current approved club relationship.
    IF p_operation IN ('update_event', 'delete_event', 'cancel_event') THEN
      RETURN public.is_event_admin(p_resource_id, p_user_id);
    END IF;

    -- Check-in, refunds and other privileged event operations
    -- require event administration rights.
    IF p_operation IN (
      'check_in',
      'refund_event',
      'manage_event_resources'
    ) THEN
      RETURN public.is_event_admin(p_resource_id, p_user_id);
    END IF;

    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_resource_action(
  TEXT,
  UUID,
  TEXT,
  UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.authorize_resource_action(
  TEXT,
  UUID,
  TEXT,
  UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.authorize_resource_action(
  TEXT,
  UUID,
  TEXT,
  UUID
) TO service_role;


-- ------------------------------------------------------------
-- Enforce the same authorization rules through RLS.
-- Frontend visibility can therefore never become the security
-- boundary.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Centralized club update authorization" ON public.clubs;

CREATE POLICY "Centralized club update authorization"
ON public.clubs
FOR UPDATE
USING (
  public.authorize_resource_action(
    'club',
    id,
    'update_club',
    auth.uid()
  )
)
WITH CHECK (
  public.authorize_resource_action(
    'club',
    id,
    'update_club',
    auth.uid()
  )
);


DROP POLICY IF EXISTS "Centralized club delete authorization" ON public.clubs;

CREATE POLICY "Centralized club delete authorization"
ON public.clubs
FOR DELETE
USING (
  public.authorize_resource_action(
    'club',
    id,
    'delete_club',
    auth.uid()
  )
);


DROP POLICY IF EXISTS "Centralized event update authorization" ON public.events;

CREATE POLICY "Centralized event update authorization"
ON public.events
FOR UPDATE
USING (
  public.authorize_resource_action(
    'event',
    id,
    'update_event',
    auth.uid()
  )
);


DROP POLICY IF EXISTS "Centralized event delete authorization" ON public.events;

CREATE POLICY "Centralized event delete authorization"
ON public.events
FOR DELETE
USING (
  public.authorize_resource_action(
    'event',
    id,
    'delete_event',
    auth.uid()
  )
);


COMMENT ON FUNCTION public.authorize_resource_action(
  TEXT,
  UUID,
  TEXT,
  UUID
)
IS
'Central server-side authorization policy. Evaluates current global role, RBAC permission, resource ownership, club membership, and event ownership. Must be used before sensitive mutations.';