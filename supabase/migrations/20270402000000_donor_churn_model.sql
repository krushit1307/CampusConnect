-- Migration: 20270402000000_donor_churn_model.sql
-- Description: Schema for tracking donor interaction metrics and churn predictions

-- 1. Track granular interaction events
CREATE TABLE IF NOT EXISTS public.donor_interaction_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE, -- Optional, if interaction is club-specific
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('email_open', 'rsvp', 'login', 'donation', 'feedback')),
    weight INTEGER NOT NULL DEFAULT 1,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_donor_interactions_user_time ON public.donor_interaction_events(user_id, occurred_at);

-- 2. Store calculated churn predictions
CREATE TABLE IF NOT EXISTS public.donor_churn_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    baseline_velocity DOUBLE PRECISION NOT NULL DEFAULT 0,
    current_velocity DOUBLE PRECISION NOT NULL DEFAULT 0,
    velocity_change_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    risk_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    contributing_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_high_value_donor BOOLEAN NOT NULL DEFAULT FALSE,
    total_donation_volume_cents INTEGER NOT NULL DEFAULT 0,
    last_meaningful_interaction_at TIMESTAMPTZ,
    alert_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, club_id) -- One active prediction per user per club
);

CREATE INDEX idx_donor_churn_risk ON public.donor_churn_predictions(club_id, risk_level);

-- 3. RLS
ALTER TABLE public.donor_interaction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donor_churn_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view donor interaction events"
    ON public.donor_interaction_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members
            WHERE club_members.club_id = donor_interaction_events.club_id
            AND club_members.user_id = auth.uid()
            AND club_members.role IN ('admin', 'owner', 'president', 'treasurer')
        )
    );

CREATE POLICY "Admins can view churn predictions"
    ON public.donor_churn_predictions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members
            WHERE club_members.club_id = donor_churn_predictions.club_id
            AND club_members.user_id = auth.uid()
            AND club_members.role IN ('admin', 'owner', 'president', 'treasurer')
        )
    );

-- Allow service_role full access (for edge functions)
CREATE POLICY "Service role full access donor_interactions" ON public.donor_interaction_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access churn_predictions" ON public.donor_churn_predictions FOR ALL TO service_role USING (true) WITH CHECK (true);
