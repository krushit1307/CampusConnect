-- Migration: 20260904000000_photo_copyright_watermarking.sql
-- Description: Storage and schema for Automated Copyright Watermarking and Vault Archiving

CREATE TABLE IF NOT EXISTS public.club_branding_assets (
    club_id UUID PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
    logo_url TEXT NOT NULL,
    copyright_holder TEXT NOT NULL,
    default_watermark_opacity NUMERIC(3, 2) NOT NULL DEFAULT 0.30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.event_watermarked_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    original_file_name TEXT NOT NULL,
    public_watermarked_url TEXT NOT NULL,
    public_storage_key TEXT NOT NULL,
    private_archive_url TEXT NOT NULL,
    private_storage_key TEXT NOT NULL,
    watermark_opacity NUMERIC(3, 2) NOT NULL DEFAULT 0.30,
    watermark_year INT NOT NULL DEFAULT 2026,
    moderation_status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (moderation_status IN ('APPROVED', 'PENDING', 'REJECTED')),
    width INT NOT NULL DEFAULT 1920,
    height INT NOT NULL DEFAULT 1080,
    file_size_bytes INT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_watermarked_photos_event ON public.event_watermarked_photos(event_id);
CREATE INDEX IF NOT EXISTS idx_watermarked_photos_club ON public.event_watermarked_photos(club_id);

-- Enable RLS
ALTER TABLE public.club_branding_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_watermarked_photos ENABLE ROW LEVEL SECURITY;

-- Policies:
-- 1. Anyone can view public watermarked assets
CREATE POLICY "Public read for approved watermarked photo assets"
    ON public.event_watermarked_photos FOR SELECT
    USING (moderation_status = 'APPROVED');

-- 2. Authenticated users can insert photo records
CREATE POLICY "Authenticated users can upload photo records"
    ON public.event_watermarked_photos FOR INSERT
    WITH CHECK (auth.uid() = uploader_id);

-- 3. Club branding viewable by all
CREATE POLICY "Public read for club branding assets"
    ON public.club_branding_assets FOR SELECT
    USING (true);
