-- =============================================================================
-- Migration: Automated Event Risk Assessment Scoring
-- Issue: #3336 - Implement 'Automated Event Risk Assessment' Scoring
-- Description: Adds risk scoring columns to the events table. Creates a 
-- status enum to quarantine high-risk events pending manual Safety Admin review.
-- =============================================================================
-- 1. Add risk assessment columns
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS risk_score INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS risk_factors TEXT [] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (
        status IN (
            'draft',
            'pending_risk_review',
            'approved',
            'rejected',
            'published'
        )
    );
COMMENT ON COLUMN public.events.risk_score IS 'Algorithmic risk score. >=10 requires manual review.';
COMMENT ON COLUMN public.events.status IS 'Lifecycle status. pending_risk_review quarantines the event from public view.';
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_risk_score ON public.events(risk_score DESC);
-- 2. RLS: Prevent public viewing of quarantined events
DROP POLICY IF EXISTS "Public can view published events" ON public.events;
CREATE POLICY "Public can view published events" ON public.events FOR
SELECT USING (
        status = 'published'
        OR status = 'approved'
    );
-- Admins can view all events
CREATE POLICY "Admins can view all events" ON public.events FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = auth.uid()
                AND role IN ('admin', 'safety_admin')
        )
    );
