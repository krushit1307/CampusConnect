-- 1. Create a helper function to securely check global roles
CREATE OR REPLACE FUNCTION public.has_global_role(role_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- We assume public.user_roles and public.roles exist from the RBAC setup.
  -- This checks if the current user has the specified global role assigned.
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = role_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_global_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_global_role(TEXT) TO service_role;

-- 2. Create the admin_club_health view
CREATE OR REPLACE VIEW public.admin_club_health AS
SELECT
    c.id AS club_id,
    c.name AS club_name,
    COALESCE(cm.member_count, 0) AS member_count,
    e.last_event_date,
    a.admin_emails
FROM public.clubs c
LEFT JOIN (
    SELECT
        club_id,
        COUNT(user_id) AS member_count
    FROM public.club_members
    GROUP BY club_id
) cm
    ON cm.club_id = c.id
LEFT JOIN (
    SELECT
        club_id,
        MAX(event_date) AS last_event_date
    FROM public.events
    GROUP BY club_id
) e
    ON e.club_id = c.id
LEFT JOIN (
    SELECT
        cm_admins.club_id,
        STRING_AGG(au.email, ', ' ORDER BY au.email) AS admin_emails
    FROM public.club_members cm_admins
    JOIN public.club_roles cr ON cr.id = cm_admins.role_id
    JOIN auth.users au ON au.id = cm_admins.user_id
    WHERE cr.title = 'admin' AND cm_admins.status = 'approved'
    GROUP BY cm_admins.club_id
) a
    ON a.club_id = c.id
WHERE public.has_global_role('University Admin') = TRUE 
   OR public.has_global_role('super_admin') = TRUE;

-- 3. Restrict access
-- The view runs as the definer (postgres), which is required to read auth.users.
-- We must revoke PUBLIC access to prevent information exposure if the WHERE clause were somehow bypassed.
REVOKE ALL ON public.admin_club_health FROM PUBLIC;
GRANT SELECT ON public.admin_club_health TO authenticated;
GRANT SELECT ON public.admin_club_health TO service_role;
