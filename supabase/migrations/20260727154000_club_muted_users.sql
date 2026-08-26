-- Migration: Add club_muted_users table and enforce mute policy on comments INSERT

-- 1. Create club_muted_users table
CREATE TABLE IF NOT EXISTS public.club_muted_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    muted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(club_id, user_id)
);

-- 2. Enable Row Level Security
ALTER TABLE public.club_muted_users ENABLE ROW LEVEL SECURITY;

-- 3. SELECT policy: viewable by everyone so frontend can inspect status
DROP POLICY IF EXISTS "Muted users are viewable by everyone." ON public.club_muted_users;
CREATE POLICY "Muted users are viewable by everyone."
ON public.club_muted_users FOR SELECT
USING (true);

-- 4. INSERT policy: only club admins and creators can mute
DROP POLICY IF EXISTS "Club admins can insert muted users." ON public.club_muted_users;
CREATE POLICY "Club admins can insert muted users."
ON public.club_muted_users FOR INSERT
WITH CHECK (
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND created_by = auth.uid())
);

-- 5. DELETE policy: only club admins and creators can unmute
DROP POLICY IF EXISTS "Club admins can delete muted users." ON public.club_muted_users;
CREATE POLICY "Club admins can delete muted users."
ON public.club_muted_users FOR DELETE
USING (
  public.is_club_admin(club_id, auth.uid()) OR
  EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND created_by = auth.uid())
);

-- 6. Re-create public.comments INSERT policy to check for mutes
DROP POLICY IF EXISTS "Club members can insert comments." ON public.comments;

CREATE POLICY "Club members can insert comments." ON public.comments FOR INSERT WITH CHECK (
  (
    EXISTS (SELECT 1 FROM public.club_members WHERE club_id = (SELECT club_id FROM public.posts WHERE id = comments.post_id) AND user_id = auth.uid() AND status = 'approved') OR
    EXISTS (SELECT 1 FROM public.clubs WHERE id = (SELECT club_id FROM public.posts WHERE id = comments.post_id) AND created_by = auth.uid())
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.club_muted_users cmu
    JOIN public.posts p ON p.club_id = cmu.club_id
    WHERE cmu.user_id = auth.uid()
      AND p.id = comments.post_id
  )
);
