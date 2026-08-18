-- =============================================================================
-- Migration: Real-Time Event Transcript Summarizer (TL;DR)
-- Issue: #3539 - Implement 'Real-Time Event Transcript Summarizer (TL;DR)'
-- Description: Creates the event_summaries table to store AI-generated bullet 
-- points derived from VTT transcripts. Includes RLS to ensure only attendees 
-- or public event viewers can access the summaries.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Event Summaries Table
CREATE TABLE IF NOT EXISTS public.event_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
    summary_points TEXT[] NOT NULL DEFAULT '{}', -- Array of 5 bullet points
    model_used TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    token_count INT DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_summaries_event ON public.event_summaries(event_id);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.event_summaries ENABLE ROW LEVEL SECURITY;

-- Anyone who can view the event can view the summary
CREATE POLICY "Users can view summaries for accessible events"
ON public.event_summaries FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_summaries.event_id
        AND (e.status = 'PUBLISHED' OR e.is_public = TRUE)
    )
);

-- Only admins/system can insert summaries (handled via Edge Function Service Role)
CREATE POLICY "System can manage summaries"
ON public.event_summaries FOR ALL
USING (auth.role() = 'service_role');
