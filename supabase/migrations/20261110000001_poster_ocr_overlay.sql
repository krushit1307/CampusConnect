-- =============================================================================
-- Migration: Real-Time "Translation Overlay" for Posters
-- Issue: #3664 - Implement 'Real-Time "Translation Overlay" for Posters'
-- Description: Adds columns to the events table to persist OCR extraction
-- results (text + normalized bounding boxes) and the detected source
-- language of the graphical poster, enabling territorial translation overlays.
-- =============================================================================

-- 1. Source language of the baked-in poster text (BCP-47 short code)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS poster_source_language TEXT NOT NULL DEFAULT 'en';

-- 2. OCR extraction payload:
--    { blocks: [ { id, text, box: { x, y, w, h }, fontSizeRatio, confidence } ], width, height }
--    All coordinates are NORMALIZED (0..1) so the frontend can scale to any render size.
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS poster_ocr_data JSONB;

COMMENT ON COLUMN public.events.poster_ocr_data IS
  'Normalized OCR bounding-box map of text baked into the event poster image.';

-- 3. GIN index so we can quickly find events that have overlay data available
CREATE INDEX IF NOT EXISTS idx_events_poster_ocr
ON public.events USING GIN (poster_ocr_data)
WHERE poster_ocr_data IS NOT NULL;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
-- OCR data is public metadata about public events; existing SELECT policies on
-- the events table already cover these new columns. No new policies required.
