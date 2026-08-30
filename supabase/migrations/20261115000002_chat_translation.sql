-- =============================================================================
-- Migration: Real-Time "Translation" for Live Chat
-- Issue: #3699 - Implement 'Real-Time "Translation" for Live Chat'
-- Description: Persists detected source language + a cached English translation
-- on chat messages so the UI can display localized text with a "View Original"
-- toggle without re-calling the translation API.
-- =============================================================================

ALTER TABLE public.event_chat_messages
ADD COLUMN IF NOT EXISTS source_lang TEXT,
ADD COLUMN IF NOT EXISTS translated_en TEXT;

COMMENT ON COLUMN public.event_chat_messages.source_lang IS
  'BCP-47 code of the language the message was originally written in.';
COMMENT ON COLUMN public.event_chat_messages.translated_en IS
  'Cached English translation used as the pivot for client-side localization.';

CREATE INDEX IF NOT EXISTS idx_chat_messages_source_lang
ON public.event_chat_messages (source_lang)
WHERE source_lang IS NOT NULL;
