-- =============================================================================
-- Migration: Accessibility Violations Audit Log
-- Issue: #3316 - Automated Accessibility Report for Club Posts
-- Description: Adds alt_text to event_images and creates the
-- accessibility_violations table so bypassed WCAG warnings (low contrast,
-- missing alt text) are logged for Student Union audits.
-- =============================================================================

ALTER TABLE public.event_images
ADD COLUMN IF NOT EXISTS alt_text TEXT;

CREATE TABLE IF NOT EXISTS public.accessibility_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    violation_type TEXT NOT NULL,
    details TEXT,
    bypassed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accessibility_violations_event
    ON public.accessibility_violations(event_id);

ALTER TABLE public.accessibility_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can log their own accessibility bypasses"
ON public.accessibility_violations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view accessibility violations"
ON public.accessibility_violations
FOR SELECT
TO authenticated
USING (public.is_admin());