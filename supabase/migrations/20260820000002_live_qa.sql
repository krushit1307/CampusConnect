-- =============================================================================
-- Migration: Live Q&A Module
-- Issue: #2898 - Develop a Real-Time 'Live Q&A' Module for Events
-- Description: Creates tables for live questions, upvotes, and moderation.
-- Enables Supabase Realtime for instant broadcasting of new questions and 
-- vote count updates to all connected event attendees.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Live Questions Table
CREATE TABLE IF NOT EXISTS public.live_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 500),
    upvotes INT NOT NULL DEFAULT 0,
    is_answered BOOLEAN NOT NULL DEFAULT FALSE,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE, -- For moderator approval flow
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_questions_event_active 
ON public.live_questions(event_id, is_answered, is_hidden, upvotes DESC);

-- 2. Question Upvotes Table (Prevents double voting)
CREATE TABLE IF NOT EXISTS public.live_question_upvotes (
    question_id UUID NOT NULL REFERENCES public.live_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (question_id, user_id)
);

-- Enable Supabase Realtime for instant UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_question_upvotes;

-- =============================================================================
-- Atomic Upvote Function (Prevents race conditions on rapid voting)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.toggle_question_upvote(
    p_question_id UUID,
    p_user_id UUID
) RETURNS INT AS $$
DECLARE
    v_exists BOOLEAN;
    v_new_count INT;
BEGIN
    -- Check if user already upvoted
    SELECT EXISTS (
        SELECT 1 FROM public.live_question_upvotes 
        WHERE question_id = p_question_id AND user_id = p_user_id
    ) INTO v_exists;

    IF v_exists THEN
        -- Remove upvote
        DELETE FROM public.live_question_upvotes 
        WHERE question_id = p_question_id AND user_id = p_user_id;
        
        UPDATE public.live_questions 
        SET upvotes = GREATEST(0, upvotes - 1) 
        WHERE id = p_question_id
        RETURNING upvotes INTO v_new_count;
    ELSE
        -- Add upvote
        INSERT INTO public.live_question_upvotes (question_id, user_id) 
        VALUES (p_question_id, p_user_id);
        
        UPDATE public.live_questions 
        SET upvotes = upvotes + 1 
        WHERE id = p_question_id
        RETURNING upvotes INTO v_new_count;
    END IF;

    RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.live_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_question_upvotes ENABLE ROW LEVEL SECURITY;

-- Anyone attending the event can view active questions
CREATE POLICY "Attendees can view live questions"
ON public.live_questions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.event_rsvps er
        WHERE er.event_id = live_questions.event_id 
        AND er.user_id = auth.uid()
    )
    AND is_hidden = FALSE
);

-- Attendees can insert their own questions
CREATE POLICY "Attendees can ask questions"
ON public.live_questions FOR INSERT
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM public.event_rsvps er
        WHERE er.event_id = live_questions.event_id 
        AND er.user_id = auth.uid()
    )
);

-- Only the author can delete their own question (or moderators via RPC)
CREATE POLICY "Users can delete own questions"
ON public.live_questions FOR DELETE
USING (auth.uid() = user_id);

-- Upvotes table RLS
CREATE POLICY "Attendees can view upvotes"
ON public.live_question_upvotes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.live_questions lq
        JOIN public.event_rsvps er ON lq.event_id = er.event_id
        WHERE lq.id = live_question_upvotes.question_id 
        AND er.user_id = auth.uid()
    )
);

CREATE POLICY "Attendees can manage own upvotes"
ON public.live_question_upvotes FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
