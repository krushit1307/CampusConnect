-- Migration: 20260801000000_direct_messages_read_at_update_policy.sql
-- Description: Add the missing UPDATE RLS policy on public.direct_messages.
--
-- The e2ee migration (20260721210000) enabled RLS and locked down SELECT and
-- INSERT, and the DELETE policy was added separately. However the app marks
-- received messages as read by calling `.update({ read_at })` from the
-- Supabase JS client (src/components/Messages/useChat.ts and ChatBox.tsx).
-- With RLS enabled and no UPDATE policy, those updates are now silently
-- rejected for every user, breaking read receipts.
--
-- A user may only touch rows they are a participant in, and may only modify
-- the read_at column — never the sender, receiver, or message content.

DROP POLICY IF EXISTS "Users can mark received messages as read." ON public.direct_messages;

CREATE POLICY "Users can mark received messages as read."
  ON public.direct_messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);
