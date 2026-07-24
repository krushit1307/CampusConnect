-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated uploads to avatars and banners" ON storage.objects;

-- Create updated policy enforcing max 2MB size and image extension constraints
CREATE POLICY "Allow authenticated uploads with size and type limits"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('avatars', 'banners')
  AND (metadata->>'size')::int <= 2097152
  AND LOWER(storage.extension(name)) IN ('png', 'jpg', 'jpeg', 'webp')
);