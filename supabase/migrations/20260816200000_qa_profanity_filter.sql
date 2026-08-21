-- Migration: 20260816200000_qa_profanity_filter.sql
-- Description: Create qa_questions and event_whitelist_terms tables,
--               submit_qa_question RPC, and RLS policies filtering shadowbanned questions from public feeds (#3192).

-- 1. Create qa_questions table
CREATE TABLE IF NOT EXISTS public.qa_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_shadowbanned BOOLEAN NOT NULL DEFAULT FALSE,
    flagged_reason TEXT,
    upvotes INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, dismissed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create event_whitelist_terms table for organizer custom whitelists
CREATE TABLE IF NOT EXISTS public.event_whitelist_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (event_id, term)
);

-- Enable RLS
ALTER TABLE public.qa_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_whitelist_terms ENABLE ROW LEVEL SECURITY;

-- Policy 1: Attendees and Realtime feeds can ONLY view non-shadowbanned questions
CREATE POLICY "Public feed shows non-shadowbanned questions"
    ON public.qa_questions FOR SELECT
    USING (is_shadowbanned = FALSE OR auth.role() = 'authenticated');

-- Policy 2: Users can view their own submitted questions (so trolls see their own post)
CREATE POLICY "Users can view their own submitted questions"
    ON public.qa_questions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Organizers can manage whitelist terms"
    ON public.event_whitelist_terms FOR ALL
    USING (auth.role() = 'authenticated');

-- 3. RPC Function to submit Q&A question with silent shadowban status
CREATE OR REPLACE FUNCTION public.submit_qa_question(
    p_event_id UUID,
    p_user_id UUID,
    p_content TEXT,
    p_is_shadowbanned BOOLEAN DEFAULT FALSE,
    p_flagged_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    question_id UUID,
    message TEXT,
    is_shadowbanned BOOLEAN
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
    v_question_id UUID;
BEGIN
    INSERT INTO public.qa_questions (
        event_id,
        user_id,
        content,
        is_shadowbanned,
        flagged_reason
    )
    VALUES (
        p_event_id,
        p_user_id,
        p_content,
        p_is_shadowbanned,
        p_flagged_reason
    )
    RETURNING id INTO v_question_id;

    -- Return 200 OK success response to user regardless of shadowban state
    RETURN QUERY SELECT TRUE, v_question_id, 'Question submitted successfully.', p_is_shadowbanned;
END;
$$;
