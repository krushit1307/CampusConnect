-- Add JSONB permissions matrix to club_roles
ALTER TABLE club_roles
ADD COLUMN permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Populate existing roles with an array of permissions based on their level
UPDATE club_roles
SET permissions = CASE
  WHEN permissions_level >= 100 THEN '["members.view", "content.view", "events.create", "content.publish", "budget.read", "analytics.view", "members.manage", "roles.assign", "club.manage"]'::jsonb
  WHEN permissions_level >= 60 THEN '["members.view", "content.view", "events.create", "content.publish", "budget.read", "analytics.view"]'::jsonb
  WHEN permissions_level >= 40 THEN '["members.view", "content.view", "events.create", "content.publish"]'::jsonb
  ELSE '["members.view", "content.view"]'::jsonb
END;

-- Helper function to check if a user has a specific permission in a club
CREATE OR REPLACE FUNCTION public.has_club_permission(p_club_id UUID, p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM club_members cm
    JOIN club_roles cr ON cm.role_id = cr.id
    WHERE cm.club_id = p_club_id 
      AND cm.user_id = p_user_id 
      AND cm.status = 'approved'
      AND (
        cr.permissions_level >= 100 -- Admins always have all permissions
        OR cr.permissions ? p_permission
      )
  );
$$;

-- Update Events policies
DROP POLICY IF EXISTS "Club admins can insert events." ON public.events;
CREATE POLICY "Club admins can insert events." ON public.events FOR INSERT WITH CHECK (
  public.has_permission(auth.uid(), 'events.create') OR
  public.has_club_permission(club_id, auth.uid(), 'events.create') OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Club admins can update events." ON public.events;
CREATE POLICY "Club admins can update events." ON public.events FOR UPDATE USING (
  public.has_permission(auth.uid(), 'events.update') OR
  public.has_club_permission(club_id, auth.uid(), 'events.create') OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.event_co_hosts ech
    WHERE ech.event_id = events.id AND public.has_club_permission(ech.club_id, auth.uid(), 'events.create')
  )
);

DROP POLICY IF EXISTS "Club admins can delete events." ON public.events;
CREATE POLICY "Club admins can delete events." ON public.events FOR DELETE USING (
  public.has_permission(auth.uid(), 'events.delete') OR
  public.has_club_permission(club_id, auth.uid(), 'events.create') OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = events.club_id AND created_by = auth.uid())
);

-- Update Posts policies
DROP POLICY IF EXISTS "Club members can insert posts." ON public.posts;
CREATE POLICY "Club members can insert posts." ON public.posts FOR INSERT WITH CHECK (
  public.has_permission(auth.uid(), 'posts.create') OR
  public.has_club_permission(club_id, auth.uid(), 'content.publish') OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = posts.club_id AND created_by = auth.uid())
);

-- Update Comments policies
DROP POLICY IF EXISTS "Authors or club admins or system admins can delete comments." ON public.comments;
CREATE POLICY "Authors or club admins or system admins can delete comments." ON public.comments FOR DELETE USING (
  auth.uid() = author_id OR
  public.has_permission(auth.uid(), 'comments.delete') OR
  public.has_club_permission((SELECT club_id FROM public.posts WHERE id = comments.post_id), auth.uid(), 'content.publish') OR
  EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = (SELECT club_id FROM public.posts WHERE id = comments.post_id)
      AND created_by = auth.uid()
  )
);
