-- Migration: Restrict comment deletion to author or club admin
-- Drop default comments delete policy and add the restricted one.

DROP POLICY IF EXISTS "Authors can delete own comments." ON public.comments;

DROP POLICY IF EXISTS "Authors or club admins can delete comments." ON public.comments;
CREATE POLICY "Authors or club admins can delete comments." ON public.comments
FOR DELETE
USING (
  auth.uid() = author_id OR
  public.is_club_admin((SELECT club_id FROM public.posts WHERE id = comments.post_id), auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = (SELECT club_id FROM public.posts WHERE id = comments.post_id)
      AND created_by = auth.uid()
  )
);
