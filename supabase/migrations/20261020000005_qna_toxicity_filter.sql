-- =============================================================================
-- Migration: Interactive Real-Time Q&A Profanity/Troll Filter
-- Issue: #3547 - Build an 'Interactive Real-Time Q&A Profanity/Troll Filter'
-- Description: Adds toxicity scoring and shadowban flags to the qna_messages 
-- table. Allows the system to hide highly toxic messages from the public feed 
-- while still acknowledging receipt to the troll's client.
-- =============================================================================
ALTER TABLE public.qna_messages
ADD COLUMN IF NOT EXISTS toxicity_score NUMERIC DEFAULT 0 CHECK (
        toxicity_score >= 0
        AND toxicity_score <= 1
    ),
    ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_flagged_for_review BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN public.qna_messages.toxicity_score IS 'AI-calculated toxicity probability from 0.0 to 1.0.';
COMMENT ON COLUMN public.qna_messages.is_shadowbanned IS 'If true, message is hidden from public feed but visible to the author.';
CREATE INDEX IF NOT EXISTS idx_qna_messages_toxicity ON public.qna_messages(toxicity_score DESC);
CREATE INDEX IF NOT EXISTS idx_qna_messages_shadowban ON public.qna_messages(is_shadowbanned)
WHERE is_shadowbanned = TRUE;
-- =============================================================================
-- Row Level Security (RLS) Updates
-- =============================================================================
-- The public feed should ONLY select messages that are not shadowbanned.
-- The author should still be able to see their own shadowbanned messages.
DROP POLICY IF EXISTS "Users can view qna messages" ON public.qna_messages;
CREATE POLICY "Users can view non-shadowbanned messages or own messages" ON public.qna_messages FOR
SELECT USING (
        is_shadowbanned = FALSE
        OR auth.uid() = user_id
        OR EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = auth.uid()
                AND role IN ('admin', 'moderator')
        )
    );
