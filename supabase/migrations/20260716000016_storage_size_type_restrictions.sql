-- Upgrading storage policies for avatar and banner uploads
-- Enforces: Max size <= 2MB and allowed extensions (png, jpg, jpeg, webp)

CREATE POLICY "Allow authenticated users to upload avatars and banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    -- Restrict to specific buckets
    (bucket_id IN ('avatars', 'banners')) 
    AND
    -- Enforce file extension types (case-insensitive)
    (lower(storage.extension(name)) IN ('png', 'jpg', 'jpeg', 'webp'))
    AND
    -- Enforce max file size of 2MB (2097152 bytes)
    ((metadata->>'size')::int <= 2097152)
);