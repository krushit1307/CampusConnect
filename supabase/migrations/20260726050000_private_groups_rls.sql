-- ============================================================
-- Migration: 20260726050000_private_groups_rls.sql
-- Issue: #1352
-- Description:
--   Creates groups, group_members, and group_posts tables if not present,
--   defines recursion-safe is_group_member and is_group_admin helper functions,
--   and enforces comprehensive RLS policies on private groups.
-- ============================================================

-- 1. Create tables if not existing
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Security Helper Functions
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND status = 'approved'
  ) OR EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = p_group_id
      AND created_by = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND role = 'admin'
      AND status = 'approved'
  ) OR EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = p_group_id
      AND created_by = p_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_group_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_group_admin(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_admin(UUID, UUID) TO authenticated, service_role;

-- 3. Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for groups
DROP POLICY IF EXISTS "Public groups viewable by authenticated, private by members" ON public.groups;
CREATE POLICY "Public groups viewable by authenticated, private by members" ON public.groups
  FOR SELECT TO authenticated
  USING (
    is_private IS FALSE OR is_private IS NULL OR
    public.is_group_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
CREATE POLICY "Authenticated users can create groups" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Group admins can update group settings" ON public.groups;
CREATE POLICY "Group admins can update group settings" ON public.groups
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(id, auth.uid()))
  WITH CHECK (public.is_group_admin(id, auth.uid()));

DROP POLICY IF EXISTS "Group admins can delete groups" ON public.groups;
CREATE POLICY "Group admins can delete groups" ON public.groups
  FOR DELETE TO authenticated
  USING (public.is_group_admin(id, auth.uid()));

-- 5. RLS Policies for group_members
DROP POLICY IF EXISTS "Members can view group members" ON public.group_members;
CREATE POLICY "Members can view group members" ON public.group_members
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
CREATE POLICY "Users can join groups" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Group admins can update member status or roles" ON public.group_members;
CREATE POLICY "Group admins can update member status or roles" ON public.group_members
  FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id, auth.uid()))
  WITH CHECK (public.is_group_admin(group_id, auth.uid()));

DROP POLICY IF EXISTS "Users can leave or admins can remove members" ON public.group_members;
CREATE POLICY "Users can leave or admins can remove members" ON public.group_members
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id OR
    public.is_group_admin(group_id, auth.uid())
  );

-- 6. RLS Policies for group_posts
DROP POLICY IF EXISTS "Group posts viewable by members or public group auth users" ON public.group_posts;
CREATE POLICY "Group posts viewable by members or public group auth users" ON public.group_posts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_posts.group_id
        AND (g.is_private IS FALSE OR g.is_private IS NULL)
    ) OR
    public.is_group_member(group_id, auth.uid())
  );

DROP POLICY IF EXISTS "Group members can insert posts" ON public.group_posts;
CREATE POLICY "Group members can insert posts" ON public.group_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id AND
    public.is_group_member(group_id, auth.uid())
  );

DROP POLICY IF EXISTS "Authors or group admins can update posts" ON public.group_posts;
CREATE POLICY "Authors or group admins can update posts" ON public.group_posts
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = author_id OR
    public.is_group_admin(group_id, auth.uid())
  );

DROP POLICY IF EXISTS "Authors or group admins can delete posts" ON public.group_posts;
CREATE POLICY "Authors or group admins can delete posts" ON public.group_posts
  FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id OR
    public.is_group_admin(group_id, auth.uid())
  );
