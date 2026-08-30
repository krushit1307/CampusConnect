-- ============================================================
-- Migration: 20260828000002_chat_sentiment_shadowban.sql
-- Issue: #4838 — Automated "Profanity/Harassment" Chat Sentiment Shadowbanning
-- Adds continuous sentiment tracking per chat message and triggers a
-- silent shadowban when a user's rolling average sentiment over their
-- last 10 messages drops below -0.7. Reuses the existing shadowban
-- routing built for #4221 (profiles.is_shadowbanned /
-- event_chat_messages.is_shadowbanned already gate real-time broadcast).
-- ============================================================

BEGIN;

-- 1. Store the per-message sentiment score (-1.0 to 1.0)
ALTER TABLE public.event_chat_messages
ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC;

-- 2. Trigger function: send new messages to the sentiment analysis
--    edge function asynchronously (mirrors the #4221 moderation trigger).
CREATE OR REPLACE FUNCTION public.handle_new_event_chat_message_sentiment()
RETURNS TRIGGER AS $$
DECLARE
    function_url TEXT := 'http://localhost:54321/functions/v1/chat-sentiment-shadowban';
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

-- 3. Attach as a second AFTER INSERT trigger alongside the #4221
--    profanity trigger. Postgres fires multiple triggers for the same
--    event in name order, so both moderation paths run independently.
DROP TRIGGER IF EXISTS on_event_chat_message_created_sentiment ON public.event_chat_messages;
CREATE TRIGGER on_event_chat_message_created_sentiment
AFTER INSERT ON public.event_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_event_chat_message_sentiment();

COMMIT;