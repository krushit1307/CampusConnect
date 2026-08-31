-- =============================================================================
-- Migration: 20261231000024_event_budget_roi.sql
-- Issue: #3941 - Build an 'Interactive Event Budget ROI' Calculator
-- Description: Tables for event budget projections, fixed expense line items,
--              break-even parameters, and RPC calculation functions.
-- =============================================================================

-- 1. Event Budget Projections Table
CREATE TABLE IF NOT EXISTS public.event_budget_projections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    venue_capacity INT NOT NULL DEFAULT 100,
    expected_attendance_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.8000,
    average_ticket_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    sponsorship_revenue NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    student_grant_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    fixed_costs_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    variable_cost_per_attendee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    break_even_tickets INT NOT NULL DEFAULT 0,
    projected_profit NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    fixed_expenses_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_event_budget_projection UNIQUE (event_id)
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_event_budget_projections_event_id ON public.event_budget_projections(event_id);

-- 2. Row Level Security
ALTER TABLE public.event_budget_projections ENABLE ROW LEVEL SECURITY;

-- Allow event hosts/officers to manage budget projections
CREATE POLICY "Event hosts can manage event budget projections"
    ON public.event_budget_projections
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.club_members cm ON cm.club_id = e.club_id
            WHERE e.id = event_budget_projections.event_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('admin', 'president', 'treasurer', 'officer')
        )
    );

-- Allow public viewing if event is public
CREATE POLICY "Public can view event budget projections"
    ON public.event_budget_projections
    FOR SELECT
    USING (true);

-- 3. Stored Procedure: Calculate Event Solvency & Break-Even
CREATE OR REPLACE FUNCTION public.calculate_event_solvency_rpc(
    p_event_id UUID,
    p_ticket_price NUMERIC,
    p_expected_turnout_rate NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_capacity INT;
    v_fixed_costs NUMERIC;
    v_variable_cost NUMERIC;
    v_sponsorships NUMERIC;
    v_grants NUMERIC;
    v_attendees INT;
    v_revenue NUMERIC;
    v_expenses NUMERIC;
    v_net_profit NUMERIC;
    v_break_even INT;
    v_result JSONB;
BEGIN
    SELECT 
        COALESCE(venue_capacity, 200),
        COALESCE(fixed_costs_total, 1000.0),
        COALESCE(variable_cost_per_attendee, 10.0),
        COALESCE(sponsorship_revenue, 0.0),
        COALESCE(student_grant_amount, 0.0)
    INTO 
        v_capacity, v_fixed_costs, v_variable_cost, v_sponsorships, v_grants
    FROM public.event_budget_projections
    WHERE event_id = p_event_id;

    IF NOT FOUND THEN
        v_capacity := 200;
        v_fixed_costs := 1000.0;
        v_variable_cost := 10.0;
        v_sponsorships := 0.0;
        v_grants := 0.0;
    END IF;

    v_attendees := ROUND(v_capacity * p_expected_turnout_rate);
    v_revenue := (v_attendees * p_ticket_price) + v_sponsorships + v_grants;
    v_expenses := v_fixed_costs + (v_attendees * v_variable_cost);
    v_net_profit := v_revenue - v_expenses;

    IF (p_ticket_price - v_variable_cost) > 0 THEN
        v_break_even := CEIL(GREATEST(0, v_fixed_costs - (v_sponsorships + v_grants)) / (p_ticket_price - v_variable_cost));
    ELSE
        v_break_even := 9999;
    END IF;

    v_result := jsonb_build_object(
        'event_id', p_event_id,
        'projected_attendees', v_attendees,
        'total_revenue', v_revenue,
        'total_expenses', v_expenses,
        'net_profit', v_net_profit,
        'break_even_tickets', v_break_even,
        'is_profitable', (v_net_profit >= 0)
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_event_solvency_rpc TO authenticated, anon;
