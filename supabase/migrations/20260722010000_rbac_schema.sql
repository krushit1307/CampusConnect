-- Migration: 20260722010000_rbac_schema.sql
-- Description: Design a robust RBAC system with hierarchical inheritance using recursive CTEs

-- 1. Create Core RBAC Tables
CREATE TABLE IF NOT EXISTS public.rbac_roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_role_id INT REFERENCES public.rbac_roles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rbac_permissions (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rbac_role_permissions (
    role_id INT REFERENCES public.rbac_roles(id) ON DELETE CASCADE,
    permission_id INT REFERENCES public.rbac_permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.rbac_user_roles (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id INT REFERENCES public.rbac_roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- 2. Seed Initial RBAC Data
-- Insert standard roles (Super Admin inherits from Club Admin, Club Admin inherits from Member)
INSERT INTO public.rbac_roles (id, name, description, parent_role_id) VALUES
    (1, 'Member', 'Standard user with basic access', NULL),
    (2, 'Club Admin', 'Can manage club resources', 1),
    (3, 'Super Admin', 'Full system access', 2)
ON CONFLICT (name) DO NOTHING;

-- Reset sequence so future inserts don't conflict
SELECT setval('public.rbac_roles_id_seq', (SELECT MAX(id) FROM public.rbac_roles));

-- Insert sample permissions
INSERT INTO public.rbac_permissions (name, description) VALUES
    ('events.view', 'View events'),
    ('events.create', 'Create new events'),
    ('events.delete', 'Delete events'),
    ('clubs.delete', 'Delete clubs (super admin only)')
ON CONFLICT (name) DO NOTHING;

-- Map permissions to roles
-- Member gets basic view access
INSERT INTO public.rbac_role_permissions (role_id, permission_id)
SELECT 1, id FROM public.rbac_permissions WHERE name IN ('events.view')
ON CONFLICT DO NOTHING;

-- Club Admin gets event creation (inherits view from Member)
INSERT INTO public.rbac_role_permissions (role_id, permission_id)
SELECT 2, id FROM public.rbac_permissions WHERE name IN ('events.create', 'events.delete')
ON CONFLICT DO NOTHING;

-- Super Admin gets club deletion (inherits all above)
INSERT INTO public.rbac_role_permissions (role_id, permission_id)
SELECT 3, id FROM public.rbac_permissions WHERE name IN ('clubs.delete')
ON CONFLICT DO NOTHING;

-- 3. Create Recursive CTE View for Effective Permissions
CREATE OR REPLACE VIEW public.user_effective_permissions AS
WITH RECURSIVE role_tree AS (
    -- Base case: the roles directly assigned to users
    SELECT 
        ur.user_id,
        r.id AS role_id,
        r.parent_role_id
    FROM public.rbac_user_roles ur
    JOIN public.rbac_roles r ON r.id = ur.role_id

    UNION ALL

    -- Recursive case: inherit from parent roles
    SELECT 
        rt.user_id,
        r.id AS role_id,
        r.parent_role_id
    FROM role_tree rt
    JOIN public.rbac_roles r ON rt.parent_role_id = r.id
)
SELECT DISTINCT 
    rt.user_id,
    p.name AS permission
FROM role_tree rt
JOIN public.rbac_role_permissions rp ON rp.role_id = rt.role_id
JOIN public.rbac_permissions p ON p.id = rp.permission_id;

-- 4. Create Secure RLS Helper Function
-- SECURITY DEFINER ensures it runs with invoker privileges, avoiding recursive RLS loops
CREATE OR REPLACE FUNCTION public.has_permission(required_permission TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.user_effective_permissions 
        WHERE user_id = auth.uid() 
        AND permission = required_permission
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. Enable RLS and add basic security to RBAC tables
ALTER TABLE public.rbac_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rbac_user_roles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to roles and permissions
CREATE POLICY "Public can view roles" ON public.rbac_roles FOR SELECT USING (true);
CREATE POLICY "Public can view permissions" ON public.rbac_permissions FOR SELECT USING (true);
CREATE POLICY "Public can view role permissions" ON public.rbac_role_permissions FOR SELECT USING (true);
CREATE POLICY "Public can view user roles" ON public.rbac_user_roles FOR SELECT USING (true);

-- Only Super Admins can modify the RBAC schema
CREATE POLICY "Super Admins can manage user roles" ON public.rbac_user_roles 
FOR ALL USING (public.has_permission('roles.manage'));

-- 6. Example: Update existing RLS using the new RBAC system
-- We update the events insert policy as an example of how to use the new helper
DROP POLICY IF EXISTS "Club admins can insert events." ON public.events;
CREATE POLICY "Club admins can insert events." ON public.events FOR INSERT WITH CHECK (
  -- Either they have the system-wide RBAC permission
  public.has_permission('events.create') 
  OR
  -- Or they are a legacy club admin
  public.is_club_admin(events.club_id, auth.uid())
  OR
  EXISTS (SELECT 1 FROM clubs WHERE id = events.club_id AND created_by = auth.uid())
);
