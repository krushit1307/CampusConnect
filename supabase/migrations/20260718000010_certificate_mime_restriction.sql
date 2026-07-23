-- Drop existing insert policy
DROP POLICY IF EXISTS "Users can upload" ON storage.objects;

CREATE POLICY "Users can upload"
ON storage.objects
FOR INSERT
WITH CHECK (
    auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
        bucket_id NOT IN (
    'avatars',
    'club-banners',
    'event-banners',
    'certificates'
)
OR (
    bucket_id IN (
        'avatars',
        'club-banners',
        'event-banners'
    )
    AND LOWER(storage.extension(name))
        IN ('png','jpg','jpeg','webp')
    AND (metadata->>'size')::int <= 2097152
)
OR (
    bucket_id = 'certificates'
    AND LOWER(storage.extension(name)) = 'pdf'
)
    )
);