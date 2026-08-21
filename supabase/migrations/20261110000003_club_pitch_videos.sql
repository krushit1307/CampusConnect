-- =============================================================================
-- Migration: Interactive "Club Pitch" Video Carousel
-- Issue: #3681 - Build an 'Interactive "Club Pitch" Video Carousel'
-- Description: Adds pitch video columns to the clubs table so the directory
-- can render a swipeable carousel of 15s vertical (9:16) autoplay videos.
-- =============================================================================

ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS pitch_video_url TEXT,
ADD COLUMN IF NOT EXISTS pitch_video_status TEXT NOT NULL DEFAULT 'none'
  CHECK (pitch_video_status IN ('none', 'processing', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS pitch_video_duration_s NUMERIC;

COMMENT ON COLUMN public.clubs.pitch_video_url IS 'Public URL of the validated 15s vertical (9:16) pitch video.';

CREATE INDEX IF NOT EXISTS idx_clubs_pitch_video
ON public.clubs(pitch_video_status)
WHERE pitch_video_url IS NOT NULL;
