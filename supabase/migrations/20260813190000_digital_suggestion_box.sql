-- Migration: 20260813190000_digital_suggestion_box.sql
-- Description: Create club_suggestions and club_suggestion_votes tables,
--               atomic upvoting RPC, and executive lifecycle status update RPC (#3013).

-- 1. Create club_suggestions table
CREATE TABLE IF NOT EXISTS public.club_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    upvotes_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, planned, completed, rejected
    exec_comment TEXT,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approved BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create club_suggestion_votes table
CREATE TABLE IF NOT EXISTS public.club_suggestion_votes (
    suggestion_id UUID REFERENCES public.club_suggestions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (suggestion_id, user_id)
);

-- Enable RLS
ALTER TABLE public.club_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_suggestion_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved suggestions"
    ON public.club_suggestions FOR SELECT
    USING (approved = TRUE OR auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can submit suggestions"
    ON public.club_suggestions FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view votes"
    ON public.club_suggestion_votes FOR SELECT
    USING (auth.role() = 'authenticated');

-- 3. RPC function to atomically toggle upvotes on a suggestion
CREATE OR REPLACE FUNCTION public.upvote_club_suggestion(
    p_suggestion_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    upvoted BOOLEAN,
    new_upvote_count INT
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
    v_vote_exists BOOLEAN;
    v_count INT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.club_suggestion_votes
        WHERE suggestion_id = p_suggestion_id AND user_id = p_user_id
    ) INTO v_vote_exists;

    IF v_vote_exists THEN
        DELETE FROM public.club_suggestion_votes
        WHERE suggestion_id = p_suggestion_id AND user_id = p_user_id;

        UPDATE public.club_suggestions
        SET upvotes_count = GREATEST(0, upvotes_count - 1)
        WHERE id = p_suggestion_id
        RETURNING upvotes_count INTO v_count;

        RETURN QUERY SELECT FALSE, v_count;
    ELSE
        INSERT INTO public.club_suggestion_votes (suggestion_id, user_id)
        VALUES (p_suggestion_id, p_user_id);

        UPDATE public.club_suggestions
        SET upvotes_count = upvotes_count + 1
        WHERE id = p_suggestion_id
        RETURNING upvotes_count INTO v_count;

        RETURN QUERY SELECT TRUE, v_count;
    END IF;
END;
$$;

-- 4. RPC function for Executives to update suggestion status and notify upvoters
CREATE OR REPLACE FUNCTION public.update_suggestion_status(
    p_suggestion_id UUID,
    p_status TEXT,
    p_exec_comment TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
    v_suggestion RECORD;
BEGIN
    SELECT * INTO v_suggestion FROM public.club_suggestions WHERE id = p_suggestion_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Suggestion not found.';
        RETURN;
    END IF;

    UPDATE public.club_suggestions
    SET status = p_status, exec_comment = COALESCE(p_exec_comment, exec_comment)
    WHERE id = p_suggestion_id;

    -- If completed, notify author and upvoters
    IF p_status = 'completed' THEN
        INSERT INTO public.notifications (user_id, title, content, type)
        SELECT DISTINCT user_id, 'Suggestion Completed!', 'A club suggestion you supported has been completed: ' || v_suggestion.title, 'suggestion_update'
        FROM (
            SELECT user_id FROM public.club_suggestion_votes WHERE suggestion_id = p_suggestion_id
            UNION
            SELECT user_id FROM public.club_suggestions WHERE id = p_suggestion_id AND user_id IS NOT NULL
        ) sub;
    END IF;

    RETURN QUERY SELECT TRUE, 'Suggestion status updated successfully.';
END;
$$;
