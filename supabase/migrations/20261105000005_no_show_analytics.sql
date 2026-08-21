-- =============================================================================
-- Migration: Automated Post-Event "No-Show" Feedback Loop
-- Issue: #3563 - Implement 'Automated Post-Event "No-Show" Feedback Loop'
-- Description: Creates the no_show_analytics table to capture 1-click survey
-- responses from users who RSVP'd but did not attend. Provides actionable
-- data to organizers on why events failed to convert RSVPs.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. No-Show Analytics Table
CREATE TYPE no_show_reason AS ENUM (
    'forgot',
    'too_much_homework',
    'transportation',
    'felt_sick',
    'schedule_conflict',
    'lost_interest',
    'other'
);

CREATE TABLE IF NOT EXISTS public.no_show_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason no_show_reason NOT NULL,
    additional_feedback TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(event_id, user_id) -- Only one reason per user per event
);

CREATE INDEX IF NOT EXISTS idx_no_show_analytics_event ON public.no_show_analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_no_show_analytics_reason ON public.no_show_analytics(reason);

-- =============================================================================
-- RPC: Log No-Show Reason (Handles 1-click URL parameters)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.log_no_show_reason(
    p_event_id UUID,
    p_user_id UUID,
    p_reason TEXT,
    p_feedback TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_reason_enum no_show_reason;
BEGIN
    -- Validate the reason string against the enum
    BEGIN
        v_reason_enum := p_reason::no_show_reason;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid reason provided: %', p_reason;
    END;

    -- Insert the analytics record (Ignore if already exists)
    INSERT INTO public.no_show_analytics (event_id, user_id, reason, additional_feedback)
    VALUES (p_event_id, p_user_id, v_reason_enum, p_feedback)
    ON CONFLICT (event_id, user_id) DO NOTHING;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.no_show_analytics ENABLE ROW LEVEL SECURITY;

-- Users can only see their own analytics records
CREATE POLICY "Users can view own no-show analytics"
ON public.no_show_analytics FOR SELECT
USING (auth.uid() = user_id);

-- System can insert via the RPC
CREATE POLICY "System can log no-show reasons"
ON public.no_show_analytics FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- Organizers can view aggregated data for their events (handled via a separate RPC or view)
CREATE POLICY "Organizers can view event analytics"
ON public.no_show_analytics FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.events e
        JOIN public.club_members cm ON e.club_id = cm.club_id
        WHERE e.id = no_show_analytics.event_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'president', 'treasurer')
    )
);

