-- ============================================================
-- Migration: Automated Event Feedback LLM Summaries
-- Issue: #4230
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create table public.event_feedback_summaries
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_feedback_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    executive_summary_markdown TEXT NOT NULL,
    top_positives JSONB NOT NULL DEFAULT '[]'::jsonb,
    top_improvements JSONB NOT NULL DEFAULT '[]'::jsonb,
    review_count INTEGER NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_feedback_summaries_event_id
ON public.event_feedback_summaries(event_id);

-- ------------------------------------------------------------
-- 2. Row Level Security
-- ------------------------------------------------------------

ALTER TABLE public.event_feedback_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organizers can view their event feedback summary."
ON public.event_feedback_summaries;

CREATE POLICY "Organizers can view their event feedback summary."
ON public.event_feedback_summaries
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.events e
        JOIN public.clubs c ON c.id = e.club_id
        WHERE e.id = event_feedback_summaries.event_id
          AND (
              c.created_by = auth.uid()
              OR EXISTS (
                  SELECT 1
                  FROM public.club_members cm
                  WHERE cm.club_id = c.id
                    AND cm.user_id = auth.uid()
                    AND cm.role = 'admin'
                    AND cm.status = 'approved'
              )
          )
    )
);

DROP POLICY IF EXISTS "Organizers can insert/update event feedback summaries."
ON public.event_feedback_summaries;

CREATE POLICY "Organizers can insert/update event feedback summaries."
ON public.event_feedback_summaries
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.events e
        JOIN public.clubs c ON c.id = e.club_id
        WHERE e.id = event_feedback_summaries.event_id
          AND (
              c.created_by = auth.uid()
              OR EXISTS (
                  SELECT 1
                  FROM public.club_members cm
                  WHERE cm.club_id = c.id
                    AND cm.user_id = auth.uid()
                    AND cm.role = 'admin'
                    AND cm.status = 'approved'
              )
          )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.events e
        JOIN public.clubs c ON c.id = e.club_id
        WHERE e.id = event_feedback_summaries.event_id
          AND (
              c.created_by = auth.uid()
              OR EXISTS (
                  SELECT 1
                  FROM public.club_members cm
                  WHERE cm.club_id = c.id
                    AND cm.user_id = auth.uid()
                    AND cm.role = 'admin'
                    AND cm.status = 'approved'
              )
          )
    )
);

-- ------------------------------------------------------------
-- 3. RPC: get_event_feedback_comments_for_summary
-- Aggregates raw text feedback from event_feedback table with authorization
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_event_feedback_comments_for_summary(
    p_event_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_club_id UUID;
    v_authorized BOOLEAN;
    v_comments JSONB;
    v_total_count INTEGER;
BEGIN
    SELECT club_id
    INTO v_club_id
    FROM public.events
    WHERE id = p_event_id;

    IF v_club_id IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    SELECT
        EXISTS (
            SELECT 1
            FROM public.clubs
            WHERE id = v_club_id
              AND created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1
            FROM public.club_members
            WHERE club_id = v_club_id
              AND user_id = auth.uid()
              AND role = 'admin'
              AND status = 'approved'
        )
    INTO v_authorized;

    IF NOT v_authorized THEN
        RAISE EXCEPTION 'Not authorized to access feedback comments';
    END IF;

    SELECT
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'rating', rating,
                    'comment', comments,
                    'created_at', created_at
                )
                ORDER BY created_at DESC
            ),
            '[]'::jsonb
        ),
        COUNT(*)
    INTO
        v_comments,
        v_total_count
    FROM public.event_feedback
    WHERE event_id = p_event_id
      AND comments IS NOT NULL
      AND TRIM(comments) <> '';

    RETURN json_build_object(
        'event_id', p_event_id,
        'review_count', v_total_count,
        'comments', v_comments
    );
END;
$$;

GRANT EXECUTE
ON FUNCTION public.get_event_feedback_comments_for_summary(UUID)
TO authenticated;
