-- Migration: 20260720190000_storage_club_banners_size_limit.sql
-- Description: Enforce max size limit (3MB) and image extension restriction on club-banners storage policies

DROP POLICY IF EXISTS "Club admins can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Club admins can update banners" ON storage.objects;

-- Allow club admins to INSERT files into their club's folder with 3MB size limit & valid extensions
CREATE POLICY "Club admins can upload banners" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'club-banners' AND
    auth.role() = 'authenticated' AND
    public.is_club_admin( (storage.foldername(name))[1]::uuid, auth.uid() ) AND
    LOWER(storage.extension(name)) IN ('png', 'jpg', 'jpeg', 'webp') AND
    ((metadata->>'size')::int IS NULL OR (metadata->>'size')::int <= 3000000)
);

-- Allow club admins to UPDATE files in their club's folder with 3MB size limit & valid extensions
CREATE POLICY "Club admins can update banners" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'club-banners' AND
    auth.role() = 'authenticated' AND
    public.is_club_admin( (storage.foldername(name))[1]::uuid, auth.uid() )
) WITH CHECK (
    bucket_id = 'club-banners' AND
    auth.role() = 'authenticated' AND
    public.is_club_admin( (storage.foldername(name))[1]::uuid, auth.uid() ) AND
    LOWER(storage.extension(name)) IN ('png', 'jpg', 'jpeg', 'webp') AND
    ((metadata->>'size')::int IS NULL OR (metadata->>'size')::int <= 3000000)
);
