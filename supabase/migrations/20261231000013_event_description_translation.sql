-- Migration: 20261231000013_event_description_translation.sql
-- Automated Event Description Translation (#3592)

-- 1. Add source_language to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS source_language TEXT DEFAULT 'en';

-- 2. Create cached event translations table
CREATE TABLE IF NOT EXISTS public.event_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    target_language TEXT NOT NULL, -- e.g., 'en', 'es', 'zh', 'fr', 'hi', 'ja'
    translated_title TEXT,
    translated_description TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'google_translate',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(event_id, target_language)
);

CREATE INDEX IF NOT EXISTS idx_event_translations_lookup ON public.event_translations(event_id, target_language);

-- Enable RLS
ALTER TABLE public.event_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view cached event translations"
    ON public.event_translations
    FOR SELECT
    TO authenticated, anon
    USING (true);

CREATE POLICY "Authenticated users or service role can insert translations"
    ON public.event_translations
    FOR INSERT
    TO authenticated, service_role
    WITH CHECK (true);
