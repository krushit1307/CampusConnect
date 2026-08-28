-- ============================================================
-- Migration: Emergency Campus Safety Drone Dispatch (#4842)
-- Captures a student's last known GPS coordinate during a Safety
-- Roll Call (#4806) and lets Campus Police dispatch an autonomous
-- drone to that coordinate, tracking dispatch status + video feed.
-- ============================================================

ALTER TABLE public.safety_check_responses
    ADD COLUMN IF NOT EXISTS last_known_latitude NUMERIC,
    ADD COLUMN IF NOT EXISTS last_known_longitude NUMERIC,
    ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.drone_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    safety_check_response_id UUID NOT NULL REFERENCES public.safety_check_responses(id) ON DELETE CASCADE,
    student_user_id UUID NOT NULL REFERENCES public.profiles(id),
    dispatched_by UUID NOT NULL REFERENCES public.profiles(id),
    target_latitude NUMERIC NOT NULL,
    target_longitude NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'DISPATCHED'
        CHECK (status IN ('DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'CANCELLED', 'FAILED')),
    drone_api_dispatch_id TEXT,
    rtmp_ingest_url TEXT,
    hls_playback_url TEXT,
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.drone_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campus safety staff can view drone dispatches"
    ON public.drone_dispatches FOR SELECT
    USING (auth.role() = 'authenticated');