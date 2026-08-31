-- Migration: 20280906000000_daf_donations.sql
-- Description: Create table to track Donor Advised Fund auto-liquidated donations

CREATE TABLE IF NOT EXISTS public.daf_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    recipient_club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    original_token TEXT NOT NULL,
    original_amount NUMERIC NOT NULL,
    usdc_amount_received NUMERIC NOT NULL,
    is_liquidated BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.daf_donations ENABLE ROW LEVEL SECURITY;

-- Select policy
CREATE POLICY "Allow select on DAF donations for all authenticated users"
    ON public.daf_donations FOR SELECT
    TO authenticated
    USING (true);

-- Insert policy
CREATE POLICY "Allow users to route DAF donations"
    ON public.daf_donations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = donor_id);
