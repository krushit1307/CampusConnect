ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- Using SECURITY DEFINER so it can read from profiles without triggering infinite recursion
CREATE OR REPLACE FUNCTION public.is_user_banned(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_banned FROM public.profiles WHERE id = p_user_id), 
    FALSE
  );
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.is_user_banned(UUID) TO authenticated;

-- ------------------------------------------------------------
-- POSTS TABLE
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
CREATE POLICY "Users can insert their own posts" 
ON public.posts 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = author_id  -- Changed from user_id to author_id
  AND NOT public.is_user_banned(auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts" 
ON public.posts 
FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = author_id  -- Changed from user_id to author_id
  AND NOT public.is_user_banned(auth.uid())
);

-- ------------------------------------------------------------
-- EVENTS TABLE
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own events" ON public.events;
CREATE POLICY "Users can insert their own events" 
ON public.events 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = created_by -- Or user_id depending on your schema
  AND NOT public.is_user_banned(auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
CREATE POLICY "Users can update their own events" 
ON public.events 
FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = created_by 
  AND NOT public.is_user_banned(auth.uid())
);

-- ------------------------------------------------------------
-- COMMENTS TABLE
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own comments" ON public.comments;
CREATE POLICY "Users can insert their own comments" 
ON public.comments 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = author_id -- Based on your trigger snippet
  AND NOT public.is_user_banned(auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;
CREATE POLICY "Users can update their own comments" 
ON public.comments 
FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = author_id
  AND NOT public.is_user_banned(auth.uid())
);

-- ------------------------------------------------------------
-- CLUB MEMBERS TABLE
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can join clubs" ON public.club_members;
CREATE POLICY "Users can join clubs" 
ON public.club_members 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = user_id 
  AND NOT public.is_user_banned(auth.uid())
);

DROP POLICY IF EXISTS "Users can update their club membership" ON public.club_members;
CREATE POLICY "Users can update their club membership" 
ON public.club_members 
FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = user_id 
  AND NOT public.is_user_banned(auth.uid())
);
