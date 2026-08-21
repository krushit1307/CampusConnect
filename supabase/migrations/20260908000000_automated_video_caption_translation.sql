-- Migration: 20260908000000_automated_video_caption_translation.sql
-- Description: Issue #3450/#3454 - Automated Video Caption Translation (Multi-language VTT storage)

-- Add translated_vtt_urls JSONB column to public.resource_transcripts
ALTER TABLE public.resource_transcripts
ADD COLUMN IF NOT EXISTS translated_vtt_urls JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.resource_transcripts.translated_vtt_urls IS 'Map of ISO language codes to Storage VTT URLs e.g. {"es": "...", "zh": "...", "fr": "..."}';
