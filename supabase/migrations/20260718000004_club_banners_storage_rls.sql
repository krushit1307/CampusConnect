-- Migration: 20260718000004_club_banners_storage_rls.sql
-- Description: Enforce RLS policies for club-banners storage bucket to ensure only club admins can write.

-- Allow club admins to INSERT files into their club's folder
CREATE POLICY "Club admins can upload banners" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'club-banners' AND
    auth.role() = 'authenticated' AND
    public.is_club_admin( (storage.foldername(name))[1]::uuid, auth.uid() )
);

-- Allow club admins to UPDATE files in their club's folder
CREATE POLICY "Club admins can update banners" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'club-banners' AND
    auth.role() = 'authenticated' AND
    public.is_club_admin( (storage.foldername(name))[1]::uuid, auth.uid() )
);

-- Allow club admins to DELETE files in their club's folder
CREATE POLICY "Club admins can delete banners" ON storage.objects
FOR DELETE USING (
    bucket_id = 'club-banners' AND
    auth.role() = 'authenticated' AND
    public.is_club_admin( (storage.foldername(name))[1]::uuid, auth.uid() )
);
