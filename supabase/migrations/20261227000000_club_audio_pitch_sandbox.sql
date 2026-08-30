-- =============================================================================
-- Migration: Interactive "Club Pitch" Audio Sandbox
-- Issue: #4163 - Build an 'Interactive "Club Pitch" Audio Sandbox'
-- Description: Creates club_audio_pitches table, storage bucket, and RLS
--              policies for 60-second audio pitch recordings per club.
-- =============================================================================

-- 1. Create club_audio_pitches table
CREATE TABLE IF NOT EXISTS public.club_audio_pitches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    audio_url TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 65),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived', 'deleted')),
    listen_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.club_audio_pitches IS 'Stores 60-second audio pitch recordings by club presidents for the TikTok-style discovery feed.';
COMMENT ON COLUMN public.club_audio_pitches.duration_seconds IS 'Duration of the audio clip in seconds (max 65s to allow slight recording overrun).';

-- Only one active pitch per club at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_audio_pitches_active_club
    ON public.club_audio_pitches(club_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_club_audio_pitches_status
    ON public.club_audio_pitches(status, created_at DESC);

-- 2. Enable RLS
ALTER TABLE public.club_audio_pitches ENABLE ROW LEVEL SECURITY;

-- Anyone can read active pitches (the discover feed is public)
CREATE POLICY "Anyone can read active audio pitches"
    ON public.club_audio_pitches
    FOR SELECT
    USING (status = 'active');

-- Club presidents/admins can insert pitches for their club
CREATE POLICY "Club leaders can insert audio pitches"
    ON public.club_audio_pitches
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = club_audio_pitches.club_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('president', 'vice_president', 'admin')
        )
    );

-- Club presidents/admins can update (archive) their own pitches
CREATE POLICY "Club leaders can update audio pitches"
    ON public.club_audio_pitches
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = club_audio_pitches.club_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('president', 'vice_president', 'admin')
        )
    );

-- 3. Create storage bucket for audio pitches
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-audio-pitches', 'club-audio-pitches', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for streaming
CREATE POLICY "Public can stream audio pitches"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'club-audio-pitches');

-- Authenticated club leaders can upload
CREATE POLICY "Authenticated users can upload audio pitches"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'club-audio-pitches');

-- 4. Listen tracking table
CREATE TABLE IF NOT EXISTS public.club_audio_pitch_listens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pitch_id UUID NOT NULL REFERENCES public.club_audio_pitches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    listened_seconds INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pitch_listens_pitch
    ON public.club_audio_pitch_listens(pitch_id);

ALTER TABLE public.club_audio_pitch_listens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own listens"
    ON public.club_audio_pitch_listens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own listens"
    ON public.club_audio_pitch_listens
    FOR SELECT
    USING (auth.uid() = user_id);

-- 5. Increment listen_count trigger
CREATE OR REPLACE FUNCTION public.increment_pitch_listen_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.club_audio_pitches
    SET listen_count = listen_count + 1
    WHERE id = NEW.pitch_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_increment_pitch_listen ON public.club_audio_pitch_listens;
CREATE TRIGGER trigger_increment_pitch_listen
    AFTER INSERT ON public.club_audio_pitch_listens
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_pitch_listen_count();
