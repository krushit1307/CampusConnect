-- Migration: 20260856000000_senior_resume_book_compiler.sql
-- Description: Automated Graduating Senior Resume Book Compiler & Corporate Sponsor Talent Dispatch (#4288)

CREATE TABLE IF NOT EXISTS public.club_senior_resume_books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  graduation_year INT NOT NULL DEFAULT 2026,
  total_seniors_count INT DEFAULT 0,
  resume_book_title TEXT NOT NULL,
  pdf_download_url TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'compiled', -- 'compiled', 'dispatched_to_sponsors'
  sponsors_notified TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for club resume book lookup
CREATE INDEX IF NOT EXISTS idx_senior_resume_books_club ON public.club_senior_resume_books(club_id, graduation_year);

-- Enable RLS
ALTER TABLE public.club_senior_resume_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read senior resume books"
ON public.club_senior_resume_books FOR SELECT
USING (true);

CREATE POLICY "Club officers manage senior resume books"
ON public.club_senior_resume_books FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.club_senior_resume_books TO authenticated, anon;
