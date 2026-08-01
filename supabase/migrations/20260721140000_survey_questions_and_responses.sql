-- ============================================================
-- Migration: 20260721140000_survey_questions_and_responses.sql
-- Issue: #507
-- Description:
--   Creates `public.survey_questions` and `public.survey_responses` tables.
--   Enables RLS with policies following repository standards and checked-in
--   attendee validation from `event_feedbacks`.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create public.survey_questions table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.survey_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for survey_questions
CREATE INDEX IF NOT EXISTS idx_survey_questions_event_id ON public.survey_questions(event_id);

-- Enable RLS on survey_questions
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;

-- Policies for survey_questions
DROP POLICY IF EXISTS "Anyone can read survey questions." ON public.survey_questions;
CREATE POLICY "Anyone can read survey questions."
ON public.survey_questions FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Club admins can insert survey questions." ON public.survey_questions;
CREATE POLICY "Club admins can insert survey questions."
ON public.survey_questions FOR INSERT
WITH CHECK (
    public.is_club_admin(
        (SELECT club_id FROM public.events WHERE id = survey_questions.event_id),
        auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM public.clubs
        WHERE id = (SELECT club_id FROM public.events WHERE id = survey_questions.event_id)
          AND created_by = auth.uid()
    )
);

DROP POLICY IF EXISTS "Club admins can update survey questions." ON public.survey_questions;
CREATE POLICY "Club admins can update survey questions."
ON public.survey_questions FOR UPDATE
USING (
    public.is_club_admin(
        (SELECT club_id FROM public.events WHERE id = survey_questions.event_id),
        auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM public.clubs
        WHERE id = (SELECT club_id FROM public.events WHERE id = survey_questions.event_id)
          AND created_by = auth.uid()
    )
);

DROP POLICY IF EXISTS "Club admins can delete survey questions." ON public.survey_questions;
CREATE POLICY "Club admins can delete survey questions."
ON public.survey_questions FOR DELETE
USING (
    public.is_club_admin(
        (SELECT club_id FROM public.events WHERE id = survey_questions.event_id),
        auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM public.clubs
        WHERE id = (SELECT club_id FROM public.events WHERE id = survey_questions.event_id)
          AND created_by = auth.uid()
    )
);

-- ------------------------------------------------------------
-- 2. Create public.survey_responses table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    answer TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(question_id, user_id)
);

-- Indexes for survey_responses
CREATE INDEX IF NOT EXISTS idx_survey_responses_question_id ON public.survey_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_user_id ON public.survey_responses(user_id);

-- Enable RLS on survey_responses
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- Policies for survey_responses

-- SELECT: Users may read only their own responses
DROP POLICY IF EXISTS "Users can read own survey responses." ON public.survey_responses;
CREATE POLICY "Users can read own survey responses."
ON public.survey_responses FOR SELECT
USING (auth.uid() = user_id);

-- INSERT: Users may insert only their own response, provided they are checked-in attendees for the event
DROP POLICY IF EXISTS "Checked-in users can insert survey responses." ON public.survey_responses;
CREATE POLICY "Checked-in users can insert survey responses."
ON public.survey_responses FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM public.event_rsvps
        JOIN public.survey_questions ON survey_questions.id = survey_responses.question_id
        WHERE event_rsvps.event_id = survey_questions.event_id
          AND event_rsvps.user_id = auth.uid()
          AND event_rsvps.checked_in = TRUE
    )
);

-- UPDATE: Users may update only their own response while satisfying the checked-in requirement
DROP POLICY IF EXISTS "Checked-in users can update own survey responses." ON public.survey_responses;
CREATE POLICY "Checked-in users can update own survey responses."
ON public.survey_responses FOR UPDATE
USING (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM public.event_rsvps
        JOIN public.survey_questions ON survey_questions.id = survey_responses.question_id
        WHERE event_rsvps.event_id = survey_questions.event_id
          AND event_rsvps.user_id = auth.uid()
          AND event_rsvps.checked_in = TRUE
    )
)
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM public.event_rsvps
        JOIN public.survey_questions ON survey_questions.id = survey_responses.question_id
        WHERE event_rsvps.event_id = survey_questions.event_id
          AND event_rsvps.user_id = auth.uid()
          AND event_rsvps.checked_in = TRUE
    )
);

-- DELETE: Users may delete only their own response
DROP POLICY IF EXISTS "Users can delete own survey responses." ON public.survey_responses;
CREATE POLICY "Users can delete own survey responses."
ON public.survey_responses FOR DELETE
USING (auth.uid() = user_id);
