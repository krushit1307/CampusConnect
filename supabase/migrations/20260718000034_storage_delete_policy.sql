-- ============================================================
-- Migration: 20260718000034_storage_delete_policy.sql
-- Description:
--   Adds an RLS DELETE policy on storage.objects so that
--   authenticated users can only delete files they own.
--
--   Ownership is asserted by matching auth.uid() against the
--   storage object's owner metadata (metadata->>'owner').
--   The owning user's top-level folder prefix is also accepted
--   as a fallback so legacy uploads (which use the foldername
--   convention enforced by the INSERT policy) remain covered.
--
-- Related issue:
--   #510 - [Backend] RLS Storage Policy: Allow Users to
--   Delete Only Their Own Storage Files
-- ============================================================

-- ------------------------------------------------------------
-- 1. Defensive cleanup
--    Drop any pre-existing delete policy so this migration is
--    idempotent and can be re-run safely (e.g. on reset).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- ------------------------------------------------------------
-- 2. Create the DELETE policy
--
--    A DELETE is allowed only when ALL of the following hold:
--      a. The caller is authenticated (TO authenticated).
--      b. auth.uid() matches the owner recorded in the
--         storage object's metadata (metadata->>'owner'),
--         OR the file lives inside the caller's own top-level
--         folder ((storage.foldername(name))[1] = auth.uid()::text),
--         which is the convention enforced by the INSERT policy
--         in 20260716000099_storage_size_type_restrictions.sql.
--
--    Note: For DELETE policies only the USING expression is
--    evaluated; WITH CHECK does not apply to DELETE.
-- ------------------------------------------------------------
CREATE POLICY "Users can delete own files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    auth.uid()::text = (metadata ->> 'owner')
    OR (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------
