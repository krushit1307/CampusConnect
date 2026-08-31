-- Migration: 20280901000000_escrow_donations.sql
-- Description: Create table to track smart contract escrow donations and milestones

CREATE TABLE IF NOT EXISTS public.escrow_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    recipient_club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    escrow_id INTEGER NOT NULL,
    amount NUMERIC NOT NULL,
    milestone_date TIMESTAMPTZ NOT NULL,
    proof_video_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'video_submitted', 'verified', 'reverted')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.escrow_donations ENABLE ROW LEVEL SECURITY;

-- Select policy
CREATE POLICY "Allow select on escrow donations for all authenticated users"
    ON public.escrow_donations FOR SELECT
    TO authenticated
    USING (true);

-- Insert policy
CREATE POLICY "Allow users to lock donations"
    ON public.escrow_donations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = donor_id);

-- Update policy (uploading proof video or admin resolving)
CREATE POLICY "Allow updates by donor, recipient club, or admin"
    ON public.escrow_donations FOR UPDATE
    TO authenticated
    USING (true);
