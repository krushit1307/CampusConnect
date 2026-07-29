-- Migration: Soft Deletes for User Content (posts and comments)
-- 1. Ensure comments table has deleted_at column
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- 2. Modify foreign key constraints to ON DELETE SET NULL
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_author_id_fkey;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_author_id_fkey;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Update RLS policies to restrict read access of deleted content to non-admins
DROP POLICY IF EXISTS "Anyone can read posts." ON public.posts;
CREATE POLICY "Anyone can read posts." ON public.posts
  FOR SELECT
  USING (deleted_at IS NULL OR public.is_system_admin());

DROP POLICY IF EXISTS "Anyone can read comments." ON public.comments;
CREATE POLICY "Anyone can read comments." ON public.comments
  FOR SELECT
  USING (deleted_at IS NULL OR public.is_system_admin());

-- 4. Update UPDATE / DELETE policies for comments
DROP POLICY IF EXISTS "Authors can update own comments." ON public.comments;
DROP POLICY IF EXISTS "Authors or club admins or system admins can update comments." ON public.comments;
CREATE POLICY "Authors or club admins or system admins can update comments." ON public.comments
  FOR UPDATE
  USING (
    auth.uid() = author_id OR
    public.is_system_admin() OR
    public.is_club_admin((SELECT club_id FROM public.posts WHERE id = comments.post_id), auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = (SELECT club_id FROM public.posts WHERE id = comments.post_id)
        AND created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors or club admins or system admins can delete comments." ON public.comments;
DROP POLICY IF EXISTS "System admins can delete comments." ON public.comments;
CREATE POLICY "System admins can delete comments." ON public.comments
  FOR DELETE
  USING (public.is_system_admin());

-- 5. Trigger to cascade soft-delete to user's posts & comments on profile deletion
CREATE OR REPLACE FUNCTION public.handle_profile_soft_delete_cascade()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts
  SET deleted_at = NOW()
  WHERE author_id = OLD.id;

  UPDATE public.comments
  SET deleted_at = NOW()
  WHERE author_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_profile_soft_delete_cascade ON public.profiles;
CREATE TRIGGER trigger_profile_soft_delete_cascade
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_soft_delete_cascade();
