-- =============================================================================
-- Migration: Add video preview URL to events table
-- Issue: #2402 - Async generation of looping video previews via FFmpeg
-- Description: Adds the preview_url column to store the S3/Storage URL of the 
-- generated 3-second looping .webm preview file.
-- =============================================================================

-- Add preview_url column to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS preview_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.events.preview_url IS 'URL to the 3-second looping .webm preview file generated via FFmpeg for feed auto-play.';

-- Add background_jobs table for BullMQ queue simulation if Redis is not available
CREATE TABLE IF NOT EXISTS public.background_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_name TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for worker polling
CREATE INDEX IF NOT EXISTS idx_background_jobs_status 
ON public.background_jobs(status, created_at) 
WHERE status = 'pending';

-- RLS Policies for background_jobs (only service role should access)
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

-- No public policies needed as service role bypasses RLS
