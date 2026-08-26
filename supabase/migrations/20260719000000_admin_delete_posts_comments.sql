-- Allow system admins to delete any discussion post or comment

-- Create a custom PostgreSQL function to check if the user is a system admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_system_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update posts policy to allow admins to soft delete (update)
DROP POLICY IF EXISTS "Admins can update posts." ON public.posts;
CREATE POLICY "Admins can update posts." ON public.posts
FOR UPDATE
USING (public.is_admin());

-- Update comments policy to allow admins to delete
DROP POLICY IF EXISTS "Authors or club admins can delete comments." ON public.comments;

DROP POLICY IF EXISTS "Authors or club admins or system admins can delete comments." ON public.comments;
CREATE POLICY "Authors or club admins or system admins can delete comments." ON public.comments
FOR DELETE
USING (
  auth.uid() = author_id OR
  public.is_admin() OR
  public.is_club_admin((SELECT club_id FROM public.posts WHERE id = comments.post_id), auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = (SELECT club_id FROM public.posts WHERE id = comments.post_id)
      AND created_by = auth.uid()
  )
);
