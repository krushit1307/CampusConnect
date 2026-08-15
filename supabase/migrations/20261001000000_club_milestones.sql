-- Migration: 20261001000000_club_milestones.sql
-- Description: Creates club_milestones table for Legacy Timeline feature

-- 1. Create club_milestones table
CREATE TABLE IF NOT EXISTS public.club_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  year INTEGER,
  date_precision TEXT NOT NULL DEFAULT 'year' CHECK (date_precision IN ('year', 'decade', 'unknown')),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.club_milestones ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for club_milestones
-- Public can view milestones for clubs they have access to
DROP POLICY IF EXISTS "Milestones are viewable by club members and public." ON public.club_milestones;
CREATE POLICY "Milestones are viewable by club members and public."
ON public.club_milestones FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM clubs
    WHERE clubs.id = club_milestones.club_id
    AND (
      clubs.visibility = 'public'
      OR public.is_club_member(clubs.id, auth.uid())
      OR auth.uid() = clubs.created_by
    )
  )
);

-- Club admins can insert milestones
DROP POLICY IF EXISTS "Club admins can insert milestones." ON public.club_milestones;
CREATE POLICY "Club admins can insert milestones."
ON public.club_milestones FOR INSERT
WITH CHECK (
  public.is_club_admin(club_id, auth.uid())
);

-- Club admins can update their own milestones
DROP POLICY IF EXISTS "Club admins can update milestones." ON public.club_milestones;
CREATE POLICY "Club admins can update milestones."
ON public.club_milestones FOR UPDATE
USING (public.is_club_admin(club_id, auth.uid()));

-- Club admins can delete their own milestones
DROP POLICY IF EXISTS "Club admins can delete milestones." ON public.club_milestones;
CREATE POLICY "Club admins can delete milestones."
ON public.club_milestones FOR DELETE
USING (public.is_club_admin(club_id, auth.uid()));

-- 4. Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_club_milestones_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_club_milestones
BEFORE UPDATE ON public.club_milestones
FOR EACH ROW EXECUTE PROCEDURE public.update_club_milestones_updated_at();

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_club_milestones_club_id ON public.club_milestones(club_id);
CREATE INDEX IF NOT EXISTS idx_club_milestones_year ON public.club_milestones(year);
CREATE INDEX IF NOT EXISTS idx_club_milestones_precision ON public.club_milestones(date_precision);