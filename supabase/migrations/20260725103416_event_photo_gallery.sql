-- 1. Create table event_photos
CREATE TABLE IF NOT EXISTS public.event_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read photos
CREATE POLICY "Anyone can view event photos"
    ON public.event_photos
    FOR SELECT
    USING (true);

-- Allow authenticated users to insert their own photos
CREATE POLICY "Authenticated users can insert their own photos"
    ON public.event_photos
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own photos
CREATE POLICY "Users can delete their own photos"
    ON public.event_photos
    FOR DELETE
    USING (auth.uid() = user_id);

-- 2. Create Storage Bucket for 'event-galleries'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-galleries', 'event-galleries', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage objects
-- Note: 'storage.objects' already has RLS enabled by default in Supabase, 
-- but we need to add policies for our specific bucket.

-- Allow public read access to 'event-galleries' bucket
CREATE POLICY "Public read access to event-galleries"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'event-galleries');

-- Allow authenticated users to upload to 'event-galleries' bucket
CREATE POLICY "Authenticated users can upload to event-galleries"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'event-galleries' AND auth.role() = 'authenticated');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own uploads in event-galleries"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'event-galleries' AND auth.uid() = owner);
