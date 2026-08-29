-- ============================================================
-- Migration: 20270307000000_live_chat_moderation_autoban.sql
-- Issue: #4221 — Automated "Profanity/Harassment" Auto-Ban
-- ============================================================

BEGIN;

-- 1. Add columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS violation_strikes INTEGER DEFAULT 0;

-- 2. Add column to event_chat_messages table
ALTER TABLE public.event_chat_messages
ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN DEFAULT FALSE;

-- 3. Update Row Level Security select policy on event_chat_messages
DROP POLICY IF EXISTS event_chat_messages_select ON public.event_chat_messages;
CREATE POLICY event_chat_messages_select
  ON public.event_chat_messages
  FOR SELECT
  USING (
    is_shadowbanned = FALSE
    OR auth.uid() = user_id
    OR EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('club_admin', 'system_admin')
    )
  );

-- 4. Update send_event_chat_message RPC to check shadowban status
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
  v_is_shadowbanned BOOLEAN := FALSE;
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

  -- Determine user's shadowban status
  SELECT COALESCE(is_shadowbanned, FALSE) INTO v_is_shadowbanned
  FROM public.profiles
  WHERE id = p_user_id;

  INSERT INTO public.event_chat_messages (event_id, user_id, content, is_shadowbanned)
  VALUES (p_event_id, p_user_id, trim(p_content), v_is_shadowbanned)
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
      'is_shadowbanned', v_row.is_shadowbanned,
      'created_at', v_row.created_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_event_chat_message(UUID, UUID, TEXT) TO anon, authenticated;

-- 5. Trigger function to asynchronously send new messages to live-chat-moderation Edge Function
CREATE OR REPLACE FUNCTION public.handle_new_event_chat_message_moderation()
RETURNS TRIGGER AS $$
DECLARE
    function_url TEXT := 'http://localhost:54321/functions/v1/live-chat-moderation';
    payload JSONB;
BEGIN
    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'event_chat_messages',
        'record', jsonb_build_object(
            'id', NEW.id,
            'content', NEW.content,
            'user_id', NEW.user_id,
            'event_id', NEW.event_id,
            'is_shadowbanned', NEW.is_shadowbanned,
            'created_at', NEW.created_at
        )
    );

    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'http_post' AND n.nspname = 'net'
    ) THEN
        PERFORM net.http_post(
            url := function_url,
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := payload
        );
    ELSIF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'http_post' AND n.nspname = 'extensions'
    ) THEN
        PERFORM extensions.http_post(
            url := function_url,
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := payload
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach trigger to AFTER INSERT on event_chat_messages table
DROP TRIGGER IF EXISTS on_event_chat_message_created_moderation ON public.event_chat_messages;
CREATE TRIGGER on_event_chat_message_created_moderation
AFTER INSERT ON public.event_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_event_chat_message_moderation();

COMMIT;
