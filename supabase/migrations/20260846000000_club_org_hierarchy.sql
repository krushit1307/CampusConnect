-- Migration: 20260846000000_club_org_hierarchy.sql
-- Description: Interactive Club Hierarchy Org Chart Editor with drag-and-drop reporting tree (#3609)

CREATE TABLE IF NOT EXISTS public.club_org_nodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.club_members(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT DEFAULT 'Executive Board',
  reports_to_id UUID REFERENCES public.club_org_nodes(id) ON DELETE SET NULL,
  bio TEXT DEFAULT NULL,
  email TEXT DEFAULT NULL,
  avatar_url TEXT DEFAULT NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for tree traversal and performance
CREATE INDEX IF NOT EXISTS idx_club_org_nodes_club ON public.club_org_nodes(club_id);
CREATE INDEX IF NOT EXISTS idx_club_org_nodes_reports_to ON public.club_org_nodes(reports_to_id);

-- Enable RLS
ALTER TABLE public.club_org_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read club org hierarchy"
ON public.club_org_nodes FOR SELECT
USING (true);

CREATE POLICY "Club leaders manage org hierarchy"
ON public.club_org_nodes FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.club_org_nodes TO authenticated, anon;
