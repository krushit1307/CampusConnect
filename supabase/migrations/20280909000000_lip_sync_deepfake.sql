-- Migration: 20280909000000_lip_sync_deepfake.sql
-- Description: Create tables for tracking video lip-sync deepfake analysis results and quarantine states

CREATE TABLE IF NOT EXISTS public.video_lipsync_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    video_name TEXT NOT NULL,
    correlation_score NUMERIC NOT NULL CHECK (correlation_score >= 0 AND correlation_score <= 1),
    is_fake BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'SAFE' CHECK (status IN ('SAFE', 'QUARANTINED')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.video_lipsync_checks ENABLE ROW LEVEL SECURITY;

-- Select policies
CREATE POLICY "Allow select on video lipsync checks for all users"
    ON public.video_lipsync_checks FOR SELECT
    TO authenticated
    USING (true);

-- Insert policy
CREATE POLICY "Allow authenticated users to insert checks"
    ON public.video_lipsync_checks FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = uploader_id);
