-- Migration: 20260827000000_data_takeout_export.sql
-- Description: Create data_export_jobs table and data-exports storage bucket for GDPR data takeout

-- 1. Create the data_export_jobs table
CREATE TABLE IF NOT EXISTS public.data_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    storage_path TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    error TEXT
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.data_export_jobs ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
CREATE POLICY "Users can view their own export jobs" 
    ON public.data_export_jobs 
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own export jobs" 
    ON public.data_export_jobs 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- 4. Create the 'data-exports' private storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('data-exports', 'data-exports', false, 524288000, ARRAY['application/zip', 'application/x-zip-compressed'])
ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = 524288000,
    allowed_mime_types = ARRAY['application/zip', 'application/x-zip-compressed'];

-- 5. Storage RLS Policies
-- Users can read their own exports
CREATE POLICY "Users can read their own exports" 
    ON storage.objects 
    FOR SELECT 
    USING (
        bucket_id = 'data-exports' 
        AND auth.uid()::text = (string_to_array(name, '/'))[1]
    );

-- (The edge function will bypass RLS for inserting files)

-- 6. Cron Cleanup Setup
-- We use a placeholder endpoint for the Edge Function that deletes the storage objects.
-- You must enable pg_net and update the URL/Headers with your actual project URL and anon/service key.
-- CREATE EXTENSION IF NOT EXISTS pg_net;
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 
-- SELECT cron.schedule(
--   'cleanup-data-exports',
--   '0 3 * * *', -- Run daily at 3 AM
--   $$
--     SELECT net.http_post(
--         url:='https://your-project.supabase.co/functions/v1/cleanup-data-exports',
--         headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb,
--         body:='{}'::jsonb
--     );
--   $$
-- );
