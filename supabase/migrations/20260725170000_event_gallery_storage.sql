-- Create event-gallery storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-gallery', 'event-gallery', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for event-gallery storage bucket

-- Allow public read access to event-gallery files
DROP POLICY IF EXISTS "Public Access Event Gallery" ON storage.objects;
CREATE POLICY "Public Access Event Gallery" ON storage.objects
FOR SELECT USING (bucket_id = 'event-gallery');

-- Allow authenticated users to upload to event-gallery
DROP POLICY IF EXISTS "Authenticated users can upload event gallery" ON storage.objects;
CREATE POLICY "Authenticated users can upload event gallery" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'event-gallery'
);

-- Allow users to delete their own uploaded gallery images
DROP POLICY IF EXISTS "Users can delete own event gallery photos" ON storage.objects;
CREATE POLICY "Users can delete own event gallery photos" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'event-gallery' AND
  auth.uid() = owner
);
