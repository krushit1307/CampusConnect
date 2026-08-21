-- Migration: 20260914000000_cross_club_collaboration_matchmaker.sql
-- Description: Issue #3686 - Develop a 'Dynamic "Cross-Club Collaboration" Matchmaker'

-- Create cross_club_matches table for AI draft similarity recommendations & pooled budget co-hosting
CREATE TABLE IF NOT EXISTS public.cross_club_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_a_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    draft_b_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    club_a_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    club_b_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    club_a_name TEXT NOT NULL,
    club_b_name TEXT NOT NULL,
    similarity_score NUMERIC NOT NULL DEFAULT 0.85, -- e.g. 0.88 (88%)
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'PROPOSED' | 'ACCEPTED' | 'DECLINED'
    draft_a_budget NUMERIC DEFAULT 0,
    draft_b_budget NUMERIC DEFAULT 0,
    pooled_budget NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying active matches for a draft event or club
CREATE INDEX IF NOT EXISTS idx_cross_club_matches_draft ON public.cross_club_matches (draft_a_id, draft_b_id, status);
CREATE INDEX IF NOT EXISTS idx_cross_club_matches_club ON public.cross_club_matches (club_a_id, club_b_id, status);

-- Enable RLS
ALTER TABLE public.cross_club_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Cross club matches readable by authenticated users" ON public.cross_club_matches;
CREATE POLICY "Cross club matches readable by authenticated users"
    ON public.cross_club_matches FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Cross club matches manageable by authenticated users" ON public.cross_club_matches;
CREATE POLICY "Cross club matches manageable by authenticated users"
    ON public.cross_club_matches FOR ALL TO authenticated USING (true);

-- Enable Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.cross_club_matches;
