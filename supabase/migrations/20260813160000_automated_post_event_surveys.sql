-- ============================================================
-- Automated Post-Event Surveys
-- Issue: #2970
-- ============================================================

-- ------------------------------------------------------------
-- 1. Feedback table
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id UUID NOT NULL
        REFERENCES public.events(id)
        ON DELETE CASCADE,

    user_id UUID NOT NULL
        REFERENCES public.profiles(id)
        ON DELETE CASCADE,

    rating INTEGER
        CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),

    comments TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_feedback_event_id
ON public.event_feedback(event_id);

CREATE INDEX IF NOT EXISTS idx_event_feedback_user_id
ON public.event_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_event_feedback_created_at
ON public.event_feedback(created_at);


-- ------------------------------------------------------------
-- 2. RLS
-- ------------------------------------------------------------

ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "Users can view own event feedback."
ON public.event_feedback;

CREATE POLICY "Users can view own event feedback."
ON public.event_feedback
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
);


DROP POLICY IF EXISTS "Checked-in users can submit event feedback."
ON public.event_feedback;

CREATE POLICY "Checked-in users can submit event feedback."
ON public.event_feedback
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1
        FROM public.event_rsvps r
        WHERE r.event_id = event_feedback.event_id
          AND r.user_id = auth.uid()
          AND r.checked_in = TRUE
    )
);


DROP POLICY IF EXISTS "Users can update own event feedback."
ON public.event_feedback;

CREATE POLICY "Users can update own event feedback."
ON public.event_feedback
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);


-- ------------------------------------------------------------
-- 3. Organizer feedback summary RPC
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_event_feedback_summary(
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
    v_attendee_count INTEGER;
    v_response_count INTEGER;
    v_average_rating NUMERIC;
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
        RAISE EXCEPTION 'Not authorized to view feedback';
    END IF;


    SELECT COUNT(*)
    INTO v_attendee_count
    FROM public.event_rsvps
    WHERE event_id = p_event_id
      AND checked_in = TRUE;


    SELECT
        COUNT(*),
        ROUND(AVG(rating), 2)
    INTO
        v_response_count,
        v_average_rating
    FROM public.event_feedback
    WHERE event_id = p_event_id
      AND rating IS NOT NULL;


    RETURN json_build_object(
        'attendee_count', COALESCE(v_attendee_count, 0),
        'response_count', COALESCE(v_response_count, 0),
        'average_rating', COALESCE(v_average_rating, 0),
        'response_rate',
            CASE
                WHEN v_attendee_count = 0 THEN 0
                ELSE ROUND(
                    (v_response_count::NUMERIC / v_attendee_count) * 100,
                    2
                )
            END
    );
END;
$$;


GRANT EXECUTE
ON FUNCTION public.get_event_feedback_summary(UUID)
TO authenticated;


-- ------------------------------------------------------------
-- 4. Schedule the hourly survey dispatcher
-- ------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM cron.job
        WHERE jobname = 'dispatch-post-event-surveys'
    ) THEN
        PERFORM cron.unschedule('dispatch-post-event-surveys');
    END IF;
END
$$;


SELECT cron.schedule(
    'dispatch-post-event-surveys',
    '0 * * * *',
    $$
    SELECT net.http_post(
        url := (
            SELECT value
            FROM secrets.decrypted_secrets
            WHERE name = 'SUPABASE_URL'
            LIMIT 1
        ) || '/functions/v1/dispatch-post-event-surveys',

        headers := jsonb_build_object(
            'Content-Type',
            'application/json',

            'Authorization',
            'Bearer ' ||
            (
                SELECT value
                FROM secrets.decrypted_secrets
                WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
                LIMIT 1
            )
        ),

        body := '{}'::jsonb
    );
    $$
);