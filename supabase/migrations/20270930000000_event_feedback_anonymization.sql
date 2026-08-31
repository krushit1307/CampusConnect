-- =============================================================================
-- Migration: 20270930000000_event_feedback_anonymization.sql
-- Description: Issue #5379 - Event Feedback Sentiment Drift Optimization
--              Ensures the event linguistic sentiment drift processor safely 
--              aggregates metrics without storing or leaking client IP data.
-- =============================================================================

BEGIN;

-- 1. Create a log table to count review-bombing incidents by anonymized hashes
CREATE TABLE IF NOT EXISTS public.feedback_anonymized_drifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    drift_delta NUMERIC(5,2) NOT NULL,
    total_reviews_evaluated INTEGER NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add safe index for reporting lookup
CREATE INDEX IF NOT EXISTS idx_feedback_anonymized_drifts_lookup
    ON public.feedback_anonymized_drifts(event_id, detected_at DESC);

-- 3. Enable RLS
ALTER TABLE public.feedback_anonymized_drifts ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY "Allow public select of anonymized drift metrics"
ON public.feedback_anonymized_drifts FOR SELECT USING (true);

CREATE POLICY "Allow authenticated manage of drift logs"
ON public.feedback_anonymized_drifts FOR ALL TO authenticated USING (true);

COMMIT;
