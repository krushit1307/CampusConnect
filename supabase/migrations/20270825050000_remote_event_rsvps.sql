-- Migration: Remote Event RSVPs Table
-- Issue #4223 — Dynamic "Multi-Campus" Federation Protocol

BEGIN;

CREATE TABLE IF NOT EXISTS public.remote_event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remote_event_id UUID NOT NULL REFERENCES public.remote_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_remote_rsvp UNIQUE (remote_event_id, user_id)
);

-- Enable RLS
ALTER TABLE public.remote_event_rsvps ENABLE ROW LEVEL SECURITY;

-- Select policy: users can view all remote event RSVPs or just their own
DROP POLICY IF EXISTS "Users can view remote event RSVPs" ON public.remote_event_rsvps;
CREATE POLICY "Users can view remote event RSVPs"
    ON public.remote_event_rsvps
    FOR SELECT
    TO authenticated
    USING (true);

-- Insert/Delete policy: service role/edge function only
-- By default service role bypasses RLS, so no user insert policy is needed.

CREATE INDEX IF NOT EXISTS idx_remote_event_rsvps_user ON public.remote_event_rsvps (user_id);
CREATE INDEX IF NOT EXISTS idx_remote_event_rsvps_event ON public.remote_event_rsvps (remote_event_id);

COMMIT;
