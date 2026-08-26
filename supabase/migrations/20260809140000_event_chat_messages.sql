-- ============================================================
-- Migration: 20260809140000_event_chat_messages.sql
-- Description: Event live chat storage for GraphQL Subscriptions (#2741).
--   - event_chat_messages  (event_id, user_id, content)
--   - RPC: send_event_chat_message (SECURITY DEFINER, takes explicit user id
--     since the GraphQL Node server authenticates via the Bearer JWT and
--     calls Supabase with the anon key / no session).
-- Issue: #2741
-- ============================================================

BEGIN;

-- ─── 1. event_chat_messages ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_chat_messages_event_created_idx
  ON public.event_chat_messages (event_id, created_at);

-- ─── 2. Row Level Security ─────────────────────────────────────────────────

ALTER TABLE public.event_chat_messages ENABLE ROW LEVEL SECURITY;

-- Read: anyone (anonymous client used by the GraphQL Node server) can read
-- event chat, mirroring how posts/events are exposed.
DROP POLICY IF EXISTS event_chat_messages_select ON public.event_chat_messages;
CREATE POLICY event_chat_messages_select
  ON public.event_chat_messages
  FOR SELECT
  USING (true);

-- Direct writes are NOT allowed through RLS; all messages go through the
-- send_event_chat_message RPC (SECURITY DEFINER), which performs auth checks.

-- ─── 3. send_event_chat_message RPC ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.send_event_chat_message(
  p_event_id UUID,
  p_user_id UUID,
  p_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.event_chat_messages;
BEGIN
  IF p_user_id IS NULL OR p_user_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED', 'message', 'You must be signed in to send a message');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'EVENT_NOT_FOUND', 'message', 'Event not found');
  END IF;

  IF p_content IS NULL OR char_length(trim(p_content)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_MESSAGE', 'message', 'Message cannot be empty');
  END IF;

  IF char_length(p_content) > 500 THEN
    RETURN jsonb_build_object('success', false, 'code', 'TOO_LONG', 'message', 'Message cannot exceed 500 characters');
  END IF;

  INSERT INTO public.event_chat_messages (event_id, user_id, content)
  VALUES (p_event_id, p_user_id, trim(p_content))
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'SENT',
    'message', 'Message sent',
    'data', jsonb_build_object(
      'id', v_row.id,
      'event_id', v_row.event_id,
      'user_id', v_row.user_id,
      'content', v_row.content,
      'created_at', v_row.created_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_event_chat_message(UUID, UUID, TEXT) TO anon, authenticated;

COMMIT;
