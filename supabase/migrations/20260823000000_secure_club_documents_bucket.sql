-- 1. Ensure club_documents storage bucket is private (public = false)
INSERT INTO storage.buckets (id, name, public)
VALUES ('club_documents', 'club_documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Storage RLS Policy: Only verified active club members can read/generate signed URLs for documents in their club directory
CREATE POLICY "Club members can generate signed URLs for private documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'club_documents'
    AND EXISTS (
        SELECT 1 FROM club_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.club_id::text = (storage.foldername(name))[1]
          AND cm.status = 'approved'
    )
);