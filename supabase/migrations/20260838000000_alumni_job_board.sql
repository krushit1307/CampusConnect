-- Migration: 20260838000000_alumni_job_board.sql
-- Description: Alumni Job Board exclusive to verified club members with 30-day auto-expiration & president moderation (#2992)

CREATE TABLE IF NOT EXISTS public.club_job_postings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  alumni_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  company_domain TEXT DEFAULT NULL,
  description TEXT NOT NULL,
  location TEXT DEFAULT 'Remote',
  job_type TEXT DEFAULT 'Full-time',
  apply_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  is_renewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast club-specific queries and expiration checks
CREATE INDEX IF NOT EXISTS idx_club_job_postings_club_id ON public.club_job_postings(club_id);
CREATE INDEX IF NOT EXISTS idx_club_job_postings_expires_at ON public.club_job_postings(expires_at);

-- Enable Row Level Security (#2992)
ALTER TABLE public.club_job_postings ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy: Restrict visibility strictly to active members of that specific club_id
CREATE POLICY "Active club members can view unexpired job postings"
ON public.club_job_postings
FOR SELECT
USING (
  expires_at > NOW() AND (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_job_postings.club_id
        AND cm.user_id = auth.uid()
        AND cm.status IN ('approved', 'active')
    )
    OR alumni_user_id = auth.uid()
  )
);

-- 2. INSERT Policy: Club members/alumni can post jobs to their club
CREATE POLICY "Members can post job listings to their club"
ON public.club_job_postings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = club_job_postings.club_id
      AND cm.user_id = auth.uid()
      AND cm.status IN ('approved', 'active')
  )
  OR alumni_user_id = auth.uid()
);

-- 3. UPDATE Policy: Post creator or club president/admin (for renewal)
CREATE POLICY "Creators and leaders can update job postings"
ON public.club_job_postings
FOR UPDATE
USING (
  alumni_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = club_job_postings.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('president', 'admin', 'officer')
  )
);

-- 4. DELETE Policy: Post creator or club president/admin (for moderation control)
CREATE POLICY "Creators and leaders can delete job postings"
ON public.club_job_postings
FOR DELETE
USING (
  alumni_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = club_job_postings.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('president', 'admin', 'officer')
  )
);

GRANT ALL ON public.club_job_postings TO authenticated;
GRANT SELECT ON public.club_job_postings TO anon;
