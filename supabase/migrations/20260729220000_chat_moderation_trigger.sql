-- Migration: 20260729220000_chat_moderation_trigger.sql
-- Description: Add moderation flags to chat_messages, create trigger function, and register pg_net HTTP hook for moderation

-- 1. Add moderation columns to chat_messages table
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS flagged_reason TEXT;

-- 2. Create trigger function to request moderation
CREATE OR REPLACE FUNCTION public.handle_new_chat_message_moderation()
RETURNS TRIGGER AS $$
DECLARE
    function_url TEXT := 'http://localhost:54321/functions/v1/chat-moderation';
    payload JSONB;
BEGIN
    payload := jsonb_build_object(
        'type', 'INSERT',
        'table', 'chat_messages',
        'record', jsonb_build_object(
            'id', NEW.id,
            'content', NEW.content,
            'sender_id', NEW.sender_id,
            'receiver_id', NEW.receiver_id,
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

COMMENT ON FUNCTION public.handle_new_chat_message_moderation() IS
'Triggers chat-moderation edge function asynchronously via pg_net HTTP POST when a new direct/chat message is created.';

-- 3. Attach trigger to AFTER INSERT on chat_messages table
DROP TRIGGER IF EXISTS on_chat_message_created_moderation ON public.chat_messages;

CREATE TRIGGER on_chat_message_created_moderation
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_chat_message_moderation();
