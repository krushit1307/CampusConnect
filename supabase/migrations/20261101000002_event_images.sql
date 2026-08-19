-- =============================================================================
-- Migration: Automated Event Poster Auto-Cropping & Resizing
-- Issue: #3548 - Implement 'Automated Event Poster Auto-Cropping & Resizing'
-- Description: Creates the event_images table to store optimized WebP variants
-- of uploaded posters (thumbnail, banner, full). Updates the events table to
-- link to the processed image record.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Event Images Table
CREATE TYPE image_processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS public.event_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
    original_url TEXT NOT NULL,
    thumb_sq_url TEXT, -- 400x400 smart-cropped WebP
    banner_url TEXT,   -- 1200x630 Open Graph WebP
    full_url TEXT,     -- Max 2000px height compressed WebP
    status image_processing_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_images_event ON public.event_images(event_id);
CREATE INDEX IF NOT EXISTS idx_event_images_status ON public.event_images(status) WHERE status = 'pending';

-- 2. Add foreign key to events table (Optional, can also just query by event_id)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS image_id UUID REFERENCES public.event_images(id) ON DELETE SET NULL;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.event_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view processed images
CREATE POLICY "Public can view processed images"
ON public.event_images FOR SELECT
USING (status = 'completed' OR auth.role() = 'service_role');

-- System can manage all images
CREATE POLICY "System can manage images"
ON public.event_images FOR ALL
USING (auth.role() = 'service_role');

-- Club admins can insert/update their own event images
CREATE POLICY "Club admins can manage own event images"
ON public.event_images FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE e.id = event_images.event_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'president')
    )
);
