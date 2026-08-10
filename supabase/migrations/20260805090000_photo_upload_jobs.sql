-- Migration: Create photo_upload_jobs table for background processing
-- Timestamp: 20260805090000

CREATE TABLE IF NOT EXISTS public.photo_upload_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index to speed up event-based queries
CREATE INDEX IF NOT EXISTS idx_photo_upload_jobs_event_id ON public.photo_upload_jobs(event_id);

-- Enable RLS
ALTER TABLE public.photo_upload_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view photo upload jobs
CREATE POLICY "Allow authenticated users to read photo upload jobs" 
ON public.photo_upload_jobs
FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert photo upload jobs
CREATE POLICY "Allow authenticated users to insert photo upload jobs" 
ON public.photo_upload_jobs
FOR INSERT TO authenticated WITH CHECK (true);

-- Allow service_role full access to manage photo upload jobs
CREATE POLICY "Allow service_role full control on photo upload jobs"
ON public.photo_upload_jobs
FOR ALL TO service_role USING (true) WITH CHECK (true);
