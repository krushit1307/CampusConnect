-- Migration: 20260857000000_club_pitch_video_compression.sql
-- Description: Interactive Club Pitch Video Compression Pipeline into HLS segments with S3 raw file purging (#4289)

CREATE TABLE IF NOT EXISTS public.club_pitch_video_pipeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  pitch_title TEXT NOT NULL,
  raw_s3_key TEXT NOT NULL,
  raw_file_size_mb NUMERIC(10, 2) NOT NULL,
  compressed_size_mb NUMERIC(10, 2) DEFAULT NULL,
  bandwidth_saved_pct NUMERIC(5, 2) DEFAULT NULL,
  master_m3u8_url TEXT DEFAULT NULL,
  resolutions TEXT[] DEFAULT '{"1080p", "720p", "480p"}',
  status TEXT NOT NULL DEFAULT 'uploaded', -- 'uploaded', 'transcoding', 'completed', 'raw_file_purged'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for club video pipeline lookup
CREATE INDEX IF NOT EXISTS idx_club_pitch_video_pipeline_club ON public.club_pitch_video_pipeline(club_id, status);

-- Enable RLS
ALTER TABLE public.club_pitch_video_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read club pitch video pipeline"
ON public.club_pitch_video_pipeline FOR SELECT
USING (true);

CREATE POLICY "Authenticated manage club pitch video pipeline"
ON public.club_pitch_video_pipeline FOR ALL
USING (auth.uid() IS NOT NULL);

GRANT ALL ON public.club_pitch_video_pipeline TO authenticated, anon;
