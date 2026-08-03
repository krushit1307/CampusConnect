-- Migration: 20260730120000_direct_messages_delete_policy.sql
-- Description: Add DELETE policy to public.direct_messages so users can
-- only ever remove their own messages at the database layer (issue #1905).
--
-- SELECT and INSERT policies were already introduced by the e2ee migration
-- (20260721170000_e2ee_direct_messages.sql). This adds the missing DELETE
-- policy so the table's full CRUD surface is locked down by RLS and no
-- participant can purge conversations they didn't author.

DROP POLICY IF EXISTS "Users can delete their own messages." ON public.direct_messages;

CREATE POLICY "Users can delete their own messages."
  ON public.direct_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);
