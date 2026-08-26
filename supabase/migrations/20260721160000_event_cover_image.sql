-- Migration: Add cover_image_url to events and configure event-covers storage bucket
-- Issue: #588
-- Description: Adds cover_image_url column with storage domain CHECK constraint and configures RLS storage policies for event-covers bucket.

-- 1. Add cover_image_url column to public.events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- 2. Add CHECK constraint to enforce valid Supabase storage URLs or NULL
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS check_events_cover_image_url;

ALTER TABLE public.events
  ADD CONSTRAINT check_events_cover_image_url
  CHECK (
    cover_image_url IS NULL OR
    cover_image_url LIKE 'https://%.supabase.co/%' OR
    cover_image_url LIKE 'https://%.supabase.in/%' OR
    cover_image_url LIKE 'http://localhost%' OR
    cover_image_url LIKE 'http://127.0.0.1%'
  );

-- 3. Ensure event-covers storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-covers', 'event-covers', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage Policies for event-covers bucket

-- Allow public read access to event-covers
DROP POLICY IF EXISTS "Public Access Event Covers" ON storage.objects;
CREATE POLICY "Public Access Event Covers" ON storage.objects
FOR SELECT USING (bucket_id = 'event-covers');

-- Allow club admins to INSERT cover images into event-covers bucket
DROP POLICY IF EXISTS "Club admins can upload event covers" ON storage.objects;
CREATE POLICY "Club admins can upload event covers" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'event-covers' AND
    auth.role() = 'authenticated' AND
    CASE
      WHEN array_length(storage.foldername(name), 1) >= 1
           AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN (
        public.is_club_admin((storage.foldername(name))[1]::uuid, auth.uid()) OR
        EXISTS (SELECT 1 FROM public.clubs WHERE id = (storage.foldername(name))[1]::uuid AND created_by = auth.uid())
      )
      ELSE true
    END
);

-- Allow club admins to UPDATE cover images in event-covers bucket
DROP POLICY IF EXISTS "Club admins can update event covers" ON storage.objects;
CREATE POLICY "Club admins can update event covers" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'event-covers' AND
    auth.role() = 'authenticated' AND
    CASE
      WHEN array_length(storage.foldername(name), 1) >= 1
           AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN (
        public.is_club_admin((storage.foldername(name))[1]::uuid, auth.uid()) OR
        EXISTS (SELECT 1 FROM public.clubs WHERE id = (storage.foldername(name))[1]::uuid AND created_by = auth.uid())
      )
      ELSE true
    END
);

-- Allow club admins to DELETE cover images from event-covers bucket
DROP POLICY IF EXISTS "Club admins can delete event covers" ON storage.objects;
CREATE POLICY "Club admins can delete event covers" ON storage.objects
FOR DELETE USING (
    bucket_id = 'event-covers' AND
    auth.role() = 'authenticated' AND
    CASE
      WHEN array_length(storage.foldername(name), 1) >= 1
           AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN (
        public.is_club_admin((storage.foldername(name))[1]::uuid, auth.uid()) OR
        EXISTS (SELECT 1 FROM public.clubs WHERE id = (storage.foldername(name))[1]::uuid AND created_by = auth.uid())
      )
      ELSE true
    END
);
