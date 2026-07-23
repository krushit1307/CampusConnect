-- ============================================================
-- Migration: 20260716000016_storage_size_type_restrictions.sql
-- Description:
-- Updates storage insert policy to enforce image type and size
-- restrictions for the avatars and banners buckets.
-- ============================================================

-- ------------------------------------------------------------
-- Drop existing insert policy
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can upload" ON storage.objects;

-- ------------------------------------------------------------
-- Create updated insert policy
-- ------------------------------------------------------------
CREATE POLICY "Users can upload" ON storage.objects FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND (
    bucket_id NOT IN ('avatars', 'club-banners', 'event-banners')
    OR (
      LOWER(storage.extension(name)) IN ('png', 'jpg', 'jpeg', 'webp')
      AND (metadata->>'size')::int <= 2097152
    )
  )
);

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------
