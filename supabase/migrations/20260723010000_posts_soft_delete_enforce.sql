-- Enforce soft-delete on posts at the RLS level.
--
-- 1. Filter soft-deleted rows out of every SELECT so no client ever
--    sees a post where deleted_at IS NOT NULL, regardless of how it
--    queries the table.
--
-- 2. Replace the hard-DELETE policy for authors with a soft-delete
--    UPDATE policy so the application never permanently removes a row.
--    Admins already have a separate UPDATE policy (20260719000000).

-- 1. Tighten the SELECT policy
DROP POLICY IF EXISTS "Anyone can read posts." ON public.posts;
CREATE POLICY "Anyone can read posts." ON public.posts
  FOR SELECT
  USING (deleted_at IS NULL);

-- 2. Drop the hard-DELETE policy for authors
DROP POLICY IF EXISTS "Authors can delete own posts." ON public.posts;

-- 3. Allow authors to soft-delete their own posts via UPDATE
DROP POLICY IF EXISTS "Authors can soft-delete own posts." ON public.posts;
CREATE POLICY "Authors can soft-delete own posts." ON public.posts
  FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);
