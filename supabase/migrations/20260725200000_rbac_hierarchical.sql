-- Migration: 20260725200000_rbac_hierarchical.sql
-- Description: Design a hierarchical Role-Based Access Control (RBAC) system using recursive CTEs.

-- 1. Create Core RBAC Tables
CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_role_id INT REFERENCES public.roles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id INT REFERENCES public.roles(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role_id, permission)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id INT REFERENCES public.roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- 2. Seed Initial Roles and Permissions
-- Seeding Roles (Member -> Event Manager -> Club President -> University Admin)
INSERT INTO public.roles (id, name, description, parent_role_id) VALUES
    (1, 'Member', 'Standard user with basic access', NULL),
    (2, 'Event Manager', 'Can manage events within clubs', 1),
    (3, 'Club President', 'Can manage club resources and roles', 2),
    (4, 'University Admin', 'Highest system administrative level', 3)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    parent_role_id = EXCLUDED.parent_role_id;

-- Reset sequence to avoid manual insert key conflicts
SELECT setval(
    'public.roles_id_seq',
    COALESCE((SELECT MAX(id) FROM public.roles), 1)
);

-- Seeding Permissions mapping
-- Member permissions
INSERT INTO public.role_permissions (role_id, permission) VALUES
    (1, 'events.view'),
    (1, 'clubs.view'),
    (1, 'posts.create'),
    (1, 'comments.create')
ON CONFLICT DO NOTHING;

-- Event Manager permissions
INSERT INTO public.role_permissions (role_id, permission) VALUES
    (2, 'events.create'),
    (2, 'events.update'),
    (2, 'events.delete')
ON CONFLICT DO NOTHING;

-- Club President permissions
INSERT INTO public.role_permissions (role_id, permission) VALUES
    (3, 'clubs.update'),
    (3, 'members.manage'),
    (3, 'clubs.create'),
    (3, 'posts.update'),
    (3, 'posts.delete'),
    (3, 'comments.update'),
    (3, 'comments.delete')
ON CONFLICT DO NOTHING;

-- University Admin permissions
INSERT INTO public.role_permissions (role_id, permission) VALUES
    (4, 'clubs.delete'),
    (4, 'roles.manage')
ON CONFLICT DO NOTHING;

-- 3. Create the has_permission helper function with recursive CTE
CREATE OR REPLACE FUNCTION public.has_permission(user_id UUID, required_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- Fast return if input parameter is null
  IF user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    WITH RECURSIVE role_hierarchy AS (
        -- Base Case: Start with the direct roles assigned to the user
        SELECT
            r.id AS role_id,
            r.parent_role_id
        FROM public.user_roles ur
        JOIN public.roles r
           ON r.id = ur.role_id
        WHERE ur.user_id = has_permission.user_id

        UNION ALL

        -- Recursive Case: Traverse up the role hierarchy chain using parent references
        SELECT r.id, r.parent_role_id
        FROM public.roles r
        JOIN role_hierarchy rh ON rh.parent_role_id = r.id
    )
    SELECT 1
    FROM role_hierarchy rh
    JOIN public.role_permissions rp ON rp.role_id = rh.role_id
    WHERE rp.permission = has_permission.required_permission
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) TO service_role;

-- 4. Enable Row Level Security (RLS) on RBAC Tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Allow read-only access to authenticated users for client-side visibility
CREATE POLICY "Public can view roles" ON public.roles FOR SELECT USING (true);
CREATE POLICY "Public can view role permissions" ON public.role_permissions FOR SELECT USING (true);
CREATE POLICY "Public can view user roles" ON public.user_roles FOR SELECT USING (true);

-- Manage tables via University Admin permissions
CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL USING (public.has_permission(auth.uid(), 'roles.manage'));
CREATE POLICY "Admins can manage roles" ON public.roles FOR ALL USING (public.has_permission(auth.uid(), 'roles.manage'));
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions FOR ALL USING (
  public.has_permission(auth.uid(), 'roles.manage')
);

-- 5. Update RLS policies for Events, Posts, and Clubs to use the hierarchical permissions check

-- CLUBS policies updates
DROP POLICY IF EXISTS "Clubs are viewable by everyone." ON public.clubs;
CREATE POLICY "Clubs are viewable by everyone." ON public.clubs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create clubs." ON public.clubs;
CREATE POLICY "Users can create clubs." ON public.clubs FOR INSERT WITH CHECK (
  auth.uid() = created_by OR public.has_permission(auth.uid(), 'clubs.create')
);

DROP POLICY IF EXISTS "Club admins can update clubs." ON public.clubs;
CREATE POLICY "Club admins can update clubs." ON public.clubs FOR UPDATE USING (
  auth.uid() = created_by OR
  public.is_club_admin(id, auth.uid()) OR
  public.has_permission(auth.uid(), 'clubs.update')
);

DROP POLICY IF EXISTS "Super admins can delete clubs." ON public.clubs;
CREATE POLICY "Super admins can delete clubs." ON public.clubs FOR DELETE USING (
  public.has_permission(auth.uid(), 'clubs.delete')
);

-- EVENTS policies updates
DROP POLICY IF EXISTS "Events are viewable by everyone." ON public.events;
CREATE POLICY "Events are viewable by everyone." ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Club admins can insert events." ON public.events;
CREATE POLICY "Club admins can insert events." ON public.events FOR INSERT WITH CHECK (
  public.has_permission(auth.uid(), 'events.create') OR
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Club admins can update events." ON public.events;
CREATE POLICY "Club admins can update events." ON public.events FOR UPDATE USING (
  public.has_permission(auth.uid(), 'events.update') OR
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.event_co_hosts ech
    WHERE ech.event_id = events.id AND public.is_club_admin(ech.club_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Club admins can delete events." ON public.events;
CREATE POLICY "Club admins can delete events." ON public.events FOR DELETE USING (
  public.has_permission(auth.uid(), 'events.delete') OR
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
);

-- POSTS policies updates
DROP POLICY IF EXISTS "Anyone can read posts." ON public.posts;
CREATE POLICY "Anyone can read posts." ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Club members can insert posts." ON public.posts;
CREATE POLICY "Club members can insert posts." ON public.posts FOR INSERT WITH CHECK (
  public.has_permission(auth.uid(), 'posts.create') OR
  EXISTS (SELECT 1 FROM public.club_members WHERE club_id = posts.club_id AND user_id = auth.uid() AND status = 'approved') OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = posts.club_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Authors can update own posts." ON public.posts;
CREATE POLICY "Authors can update own posts." ON public.posts FOR UPDATE USING (
  auth.uid() = author_id OR public.has_permission(auth.uid(), 'posts.update')
);

DROP POLICY IF EXISTS "Authors can delete own posts." ON public.posts;
CREATE POLICY "Authors can delete own posts." ON public.posts FOR DELETE USING (
  auth.uid() = author_id OR public.has_permission(auth.uid(), 'posts.delete')
);

DROP POLICY IF EXISTS "Admins can update posts." ON public.posts;
CREATE POLICY "Admins can update posts." ON public.posts FOR UPDATE USING (
  public.has_permission(auth.uid(), 'posts.update')
);

-- COMMENTS policies updates
DROP POLICY IF EXISTS "Anyone can read comments." ON public.comments;
CREATE POLICY "Anyone can read comments." ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Club members can insert comments." ON public.comments;
CREATE POLICY "Club members can insert comments." ON public.comments FOR INSERT WITH CHECK (
  public.has_permission(auth.uid(), 'comments.create') OR
  EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = (SELECT club_id FROM public.posts WHERE id = comments.post_id)
      AND user_id = auth.uid() AND status = 'approved'
  ) OR
  EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = (SELECT club_id FROM public.posts WHERE id = comments.post_id)
      AND created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authors can update own comments." ON public.comments;
CREATE POLICY "Authors can update own comments." ON public.comments FOR UPDATE USING (
  auth.uid() = author_id OR public.has_permission(auth.uid(), 'comments.update')
);

DROP POLICY IF EXISTS "Authors or club admins or system admins can delete comments." ON public.comments;
CREATE POLICY "Authors or club admins or system admins can delete comments." ON public.comments FOR DELETE USING (
  auth.uid() = author_id OR
  public.has_permission(auth.uid(), 'comments.delete') OR
  public.is_club_admin((SELECT club_id FROM public.posts WHERE id = comments.post_id), auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = (SELECT club_id FROM public.posts WHERE id = comments.post_id)
      AND created_by = auth.uid()
  )
);
