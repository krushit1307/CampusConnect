-- Migration: 20260728120000_club_documents_rls.sql
-- Description: Enforce Granular Row Level Security (RLS) on Club Documents storage bucket.
-- Issue: #1452

-- 1. Create or ensure private storage bucket 'club-documents'
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-documents', 'club-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Cleanup existing/pre-existing policies defensively
DROP POLICY IF EXISTS "Club members can view club documents" ON storage.objects;
DROP POLICY IF EXISTS "Club admins can upload club documents" ON storage.objects;
DROP POLICY IF EXISTS "Club admins can update club documents" ON storage.objects;
DROP POLICY IF EXISTS "Club admins can delete club documents" ON storage.objects;

-- 3. SELECT Policy: Only verified (approved) club members or club creator can view documents
CREATE POLICY "Club members can view club documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'club-documents' AND
  (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AND
  (
    public.is_club_member((storage.foldername(name))[1]::uuid, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = (storage.foldername(name))[1]::uuid AND created_by = auth.uid()
    )
  )
);

-- 4. INSERT Policy: Restricted to club admins or club creator
CREATE POLICY "Club admins can upload club documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'club-documents' AND
  (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AND
  (
    public.is_club_admin((storage.foldername(name))[1]::uuid, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = (storage.foldername(name))[1]::uuid AND created_by = auth.uid()
    )
  )
);

-- 5. UPDATE Policy: Restricted to club admins or club creator
CREATE POLICY "Club admins can update club documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'club-documents' AND
  (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AND
  (
    public.is_club_admin((storage.foldername(name))[1]::uuid, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = (storage.foldername(name))[1]::uuid AND created_by = auth.uid()
    )
  )
);

-- 6. DELETE Policy: Restricted to club admins or club creator
CREATE POLICY "Club admins can delete club documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'club-documents' AND
  (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AND
  (
    public.is_club_admin((storage.foldername(name))[1]::uuid, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.clubs
      WHERE id = (storage.foldername(name))[1]::uuid AND created_by = auth.uid()
    )
  )
);
