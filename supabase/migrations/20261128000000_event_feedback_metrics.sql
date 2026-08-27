-- ============================================================
-- Migration: 20261128000000_event_feedback_metrics.sql
-- Issue: #3434
-- Description:
--   Adds a dynamic, crowd-sourced, multi-dimensional event rating
--   system. Stores per-metric scores (0-100) for every checked-in
--   attendee, keeps organizer-defined metric names on the event,
--   and exposes an aggregate RPC used by the organizer dashboard
--   radar chart.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add organizer-defined rating dimensions to events
-- ------------------------------------------------------------

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS rating_metrics JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.rating_metrics IS
'Organizer-defined crowd-sourced rating dimensions shown as 0-100 sliders after the event (e.g. ["Food Quality", "Networking Value"]).';

-- ------------------------------------------------------------
-- 2. Create public.event_feedback_metrics table
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_feedback_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id UUID NOT NULL
        REFERENCES public.events(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    metric_name TEXT NOT NULL,

    score INTEGER NOT NULL
        CHECK (score BETWEEN 0 AND 100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (event_id, user_id, metric_name)
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_event_feedback_metrics_event_id
ON public.event_feedback_metrics(event_id);

CREATE INDEX IF NOT EXISTS idx_event_feedback_metrics_user_id
ON public.event_feedback_metrics(user_id);

CREATE INDEX IF NOT EXISTS idx_event_feedback_metrics_metric_name
ON public.event_feedback_metrics(metric_name);

-- ------------------------------------------------------------
-- Enable Row Level Security
-- ------------------------------------------------------------

ALTER TABLE public.event_feedback_metrics ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Policies
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can read event feedback metrics."
ON public.event_feedback_metrics;

CREATE POLICY "Anyone can read event feedback metrics."
ON public.event_feedback_metrics
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Checked-in users can submit event feedback metrics."
ON public.event_feedback_metrics;

CREATE POLICY "Checked-in users can submit event feedback metrics."
ON public.event_feedback_metrics
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM public.event_rsvps
        WHERE event_rsvps.event_id = event_feedback_metrics.event_id
          AND event_rsvps.user_id = auth.uid()
          AND event_rsvps.checked_in = TRUE
    )
);

DROP POLICY IF EXISTS "Users can update own event feedback metrics."
ON public.event_feedback_metrics;

CREATE POLICY "Users can update own event feedback metrics."
ON public.event_feedback_metrics
FOR UPDATE
USING (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM public.event_rsvps
        WHERE event_rsvps.event_id = event_feedback_metrics.event_id
          AND event_rsvps.user_id = auth.uid()
          AND event_rsvps.checked_in = TRUE
    )
)
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM public.event_rsvps
        WHERE event_rsvps.event_id = event_feedback_metrics.event_id
          AND event_rsvps.user_id = auth.uid()
          AND event_rsvps.checked_in = TRUE
    )
);

DROP POLICY IF EXISTS "Users can delete own event feedback metrics."
ON public.event_feedback_metrics;

CREATE POLICY "Users can delete own event feedback metrics."
ON public.event_feedback_metrics
FOR DELETE
USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. Aggregate RPC for the organizer dashboard radar chart
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_event_feedback_metrics_summary(
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
        RAISE EXCEPTION 'Not authorized to view feedback metrics';
    END IF;

    RETURN json_build_object(
        'metrics', COALESCE(
            (
                SELECT json_agg(
                    json_build_object(
                        'metric_name', m.metric_name,
                        'average_score', ROUND(m.avg_score, 2),
                        'response_count', m.response_count
                    )
                    ORDER BY m.metric_name
                )
                FROM (
                    SELECT
                        metric_name,
                        AVG(score) AS avg_score,
                        COUNT(*) AS response_count
                    FROM public.event_feedback_metrics
                    WHERE event_id = p_event_id
                    GROUP BY metric_name
                ) m
            ),
            '[]'::json
        )
    );
END;
$$;

GRANT EXECUTE
ON FUNCTION public.get_event_feedback_metrics_summary(UUID)
TO authenticated;

-- ------------------------------------------------------------
-- End of migration
-- ------------------------------------------------------------
