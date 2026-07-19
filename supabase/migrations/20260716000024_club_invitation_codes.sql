-- Create club invite codes table
CREATE TABLE IF NOT EXISTS public.club_invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  club_id UUID NOT NULL
    REFERENCES public.clubs(id)
    ON DELETE CASCADE,

  code TEXT NOT NULL UNIQUE,

  expires_at TIMESTAMPTZ,

  max_uses INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.club_invite_codes
ENABLE ROW LEVEL SECURITY;

-- Anyone can view invite codes for now
DROP POLICY IF EXISTS "Club invite codes are viewable by everyone." ON public.club_invite_codes;
CREATE POLICY "Club invite codes are viewable by everyone."
ON public.club_invite_codes
FOR SELECT
USING (true);

-- Club admins can create invite codes
DROP POLICY IF EXISTS "Club admins can create invite codes." ON public.club_invite_codes;
CREATE POLICY "Club admins can create invite codes."
ON public.club_invite_codes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM club_members
    WHERE club_id = club_invite_codes.club_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'approved'
  )
  OR
  EXISTS (
    SELECT 1
    FROM clubs
    WHERE id = club_invite_codes.club_id
      AND created_by = auth.uid()
  )
);

-- Club admins can update invite codes
DROP POLICY IF EXISTS "Club admins can update invite codes." ON public.club_invite_codes;
CREATE POLICY "Club admins can update invite codes."
ON public.club_invite_codes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM club_members
    WHERE club_id = club_invite_codes.club_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'approved'
  )
  OR
  EXISTS (
    SELECT 1
    FROM clubs
    WHERE id = club_invite_codes.club_id
      AND created_by = auth.uid()
  )
);

-- Club admins can delete invite codes
DROP POLICY IF EXISTS "Club admins can delete invite codes." ON public.club_invite_codes;
CREATE POLICY "Club admins can delete invite codes."
ON public.club_invite_codes
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM club_members
    WHERE club_id = club_invite_codes.club_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND status = 'approved'
  )
  OR
  EXISTS (
    SELECT 1
    FROM clubs
    WHERE id = club_invite_codes.club_id
      AND created_by = auth.uid()
  )
);