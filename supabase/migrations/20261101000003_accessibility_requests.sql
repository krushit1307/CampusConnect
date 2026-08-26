-- =============================================================================
-- Migration: Dynamic Accessibility Sign Language Interpreter Request
-- Issue: #3551 - Implement 'Dynamic Accessibility Sign Language Interpreter Request'
-- Description: Creates the accessibility_requests table to track ASL interpreter
-- and captioning device requests linked to event RSVPs. Includes status tracking
-- for the University Disability Resource Center to confirm fulfillment.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Accessibility Requests Table
CREATE TYPE accessibility_type AS ENUM ('asl_interpreter', 'captioning_device', 'wheelchair_access', 'other');
CREATE TYPE request_status AS ENUM ('pending', 'confirmed', 'denied', 'fulfilled');

CREATE TABLE IF NOT EXISTS public.accessibility_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rsvp_id UUID NOT NULL REFERENCES public.event_rsvps(id) ON DELETE CASCADE UNIQUE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_type accessibility_type NOT NULL,
    additional_notes TEXT,
    status request_status NOT NULL DEFAULT 'pending',
    confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accessibility_requests_event ON public.accessibility_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_accessibility_requests_user ON public.accessibility_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_accessibility_requests_status ON public.accessibility_requests(status) WHERE status = 'pending';

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.accessibility_requests ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own requests
CREATE POLICY "Users can manage own accessibility requests"
ON public.accessibility_requests FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Disability Center Admins can view and update ALL requests
CREATE POLICY "Disability admins can manage all requests"
ON public.accessibility_requests FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'disability_admin')
);

-- System can read for email triggers
CREATE POLICY "System can read requests"
ON public.accessibility_requests FOR SELECT
USING (auth.role() = 'service_role');
