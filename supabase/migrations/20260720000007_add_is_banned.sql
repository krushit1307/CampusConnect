-- ============================================================
-- Migration: 20260720000007_add_is_banned.sql
-- Description:
-- Adds is_banned column to profiles table and enforces strict
-- Row Level Security (RLS) INSERT and UPDATE policies across all
-- interactive tables (posts, comments, event_rsvps, events, club_members)
-- to block banned users from making modifications via API or UI.
-- ============================================================

-- 1. Add column to profiles (default FALSE)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- 2. Create SECURITY DEFINER helper function to safely check ban status
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
DROP POLICY IF EXISTS "Club members can insert posts." ON public.posts;
CREATE POLICY "Users can insert their own posts" 
ON public.posts 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = author_id
  AND NOT public.is_user_banned(auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Authors can update own posts." ON public.posts;
CREATE POLICY "Users can update their own posts" 
ON public.posts 
FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = author_id
  AND NOT public.is_user_banned(auth.uid())
);

-- ------------------------------------------------------------
-- COMMENTS TABLE
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own comments" ON public.comments;
DROP POLICY IF EXISTS "Club members can insert comments." ON public.comments;
CREATE POLICY "Users can insert their own comments" 
ON public.comments 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = author_id
  AND NOT public.is_user_banned(auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;
DROP POLICY IF EXISTS "Authors can update own comments." ON public.comments;
CREATE POLICY "Users can update their own comments" 
ON public.comments 
FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = author_id
  AND NOT public.is_user_banned(auth.uid())
);

-- ------------------------------------------------------------
-- EVENT RSVPS TABLE
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can RSVP." ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can insert their own RSVPs" ON public.event_rsvps;
CREATE POLICY "Users can RSVP." 
ON public.event_rsvps 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.is_user_banned(auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own RSVPs." ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can update their own RSVPs" ON public.event_rsvps;
CREATE POLICY "Users can update their own RSVPs." 
ON public.event_rsvps 
FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = user_id
  AND NOT public.is_user_banned(auth.uid())
);

-- ------------------------------------------------------------
-- EVENTS TABLE
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own events" ON public.events;
DROP POLICY IF EXISTS "Club members can insert events." ON public.events;
CREATE POLICY "Users can insert their own events" 
ON public.events 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = created_by
  AND NOT public.is_user_banned(auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
DROP POLICY IF EXISTS "Authors can update own events." ON public.events;
CREATE POLICY "Users can update their own events" 
ON public.events 
FOR UPDATE 
TO authenticated 
USING (
  auth.uid() = created_by
  AND NOT public.is_user_banned(auth.uid())
);

-- ------------------------------------------------------------
-- CLUB MEMBERS TABLE
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can join clubs" ON public.club_members;
DROP POLICY IF EXISTS "Users can join clubs." ON public.club_members;
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
