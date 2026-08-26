-- Migration: 20260828000000_club_onboarding_wizard.sql
-- Description: Adds onboarding columns to clubs, creates club_invitations, and configures storage.

-- 1. Add onboarding columns to clubs
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS constitution_url TEXT;

-- 2. Create club_invitations table if not exists
CREATE TABLE IF NOT EXISTS public.club_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for club_invitations
ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent conflicts
DROP POLICY IF EXISTS "Anyone can view club invitations" ON public.club_invitations;
DROP POLICY IF EXISTS "Users can manage invitations for their clubs" ON public.club_invitations;

-- Create policies for club_invitations
CREATE POLICY "Anyone can view club invitations"
ON public.club_invitations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage invitations for their clubs"
ON public.club_invitations FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.club_members
        WHERE club_id = club_invitations.club_id
          AND user_id = auth.uid()
          AND role = 'admin'
    )
);

-- 3. Setup club-constitutions storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-constitutions', 'club-constitutions', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Allow authenticated users to upload club constitutions" ON storage.objects;
DROP POLICY IF EXISTS "Allow anyone to read club constitutions" ON storage.objects;

-- Create policies for storage
CREATE POLICY "Allow authenticated users to upload club constitutions"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'club-constitutions');

CREATE POLICY "Allow anyone to read club constitutions"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'club-constitutions');
