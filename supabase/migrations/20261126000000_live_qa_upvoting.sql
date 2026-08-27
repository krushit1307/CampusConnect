-- =============================================================================
-- Migration: Live Q&A Upvoting System
-- Issue: #3272 - Develop a 'Live Interactive Q&A Upvoting' System
-- Description: Extends event_questions with an upvotes_count column,
--              creates the question_votes table to enforce single upvoting,
--              defines the toggle_question_vote RPC, and sets up RLS policies.
-- =============================================================================

-- 1. Expand event_questions to include upvotes_count column
ALTER TABLE public.event_questions 
ADD COLUMN IF NOT EXISTS upvotes_count INT NOT NULL DEFAULT 0;

-- Create index for performance on queries sorting by upvotes
CREATE INDEX IF NOT EXISTS idx_event_questions_event_upvotes 
ON public.event_questions(event_id, status, upvotes_count DESC, created_at ASC);

-- 2. Create question_votes junction table to prevent users from voting twice
CREATE TABLE IF NOT EXISTS public.question_votes (
    question_id UUID NOT NULL REFERENCES public.event_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (question_id, user_id)
);

-- Enable RLS
ALTER TABLE public.question_votes ENABLE ROW LEVEL SECURITY;

-- Configure Row Level Security (RLS) policies
CREATE POLICY "Anyone can view question votes" 
ON public.question_votes FOR SELECT 
USING (true);

CREATE POLICY "Users can manage their own votes" 
ON public.question_votes FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Enable Supabase Realtime for the question_votes table
ALTER PUBLICATION supabase_realtime ADD TABLE public.question_votes;

-- 3. Atomic toggle question vote RPC function
CREATE OR REPLACE FUNCTION public.toggle_question_vote(
    p_question_id UUID
) RETURNS INT AS $$
DECLARE
    v_user_id UUID;
    v_exists BOOLEAN;
    v_new_count INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if user already upvoted this question
    SELECT EXISTS (
        SELECT 1 FROM public.question_votes 
        WHERE question_id = p_question_id AND user_id = v_user_id
    ) INTO v_exists;

    IF v_exists THEN
        -- Remove upvote
        DELETE FROM public.question_votes 
        WHERE question_id = p_question_id AND user_id = v_user_id;
        
        UPDATE public.event_questions 
        SET upvotes_count = GREATEST(0, upvotes_count - 1) 
        WHERE id = p_question_id
        RETURNING upvotes_count INTO v_new_count;
    ELSE
        -- Add upvote
        INSERT INTO public.question_votes (question_id, user_id) 
        VALUES (p_question_id, v_user_id);
        
        UPDATE public.event_questions 
        SET upvotes_count = upvotes_count + 1 
        WHERE id = p_question_id
        RETURNING upvotes_count INTO v_new_count;
    END IF;

    RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
