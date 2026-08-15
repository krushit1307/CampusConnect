-- Migration: 20261022000003_club_revival_requests.sql
-- Description: Create club_revival_requests table for students to petition reviving a club.

CREATE TYPE revival_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS public.club_revival_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    motivation TEXT NOT NULL,
    leadership_plan TEXT NOT NULL,
    status revival_status DEFAULT 'pending',
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying requests
CREATE INDEX IF NOT EXISTS idx_revival_requests_club ON public.club_revival_requests(club_id);
CREATE INDEX IF NOT EXISTS idx_revival_requests_status ON public.club_revival_requests(status);

-- RLS
ALTER TABLE public.club_revival_requests ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can submit a request
CREATE POLICY "Users can create revival requests"
ON public.club_revival_requests
FOR INSERT
WITH CHECK (auth.uid() = requested_by);

-- Users can view their own requests
CREATE POLICY "Users can view their own requests"
ON public.club_revival_requests
FOR SELECT
USING (auth.uid() = requested_by);

-- Wait, SU Admins can view/update all. Assuming a role check or similar. 
-- In CampusConnect, typically admin policies use `(SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')` or similar.
-- Or just check helper_rls_functions.
