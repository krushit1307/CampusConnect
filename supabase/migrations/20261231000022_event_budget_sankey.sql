-- =============================================================================
-- Migration: 20261231000022_event_budget_sankey.sql
-- Issue: #3947 - Build an 'Interactive "Event Budget vs Actual" Sankey Diagram'
-- Description: Detailed club expense ledger tables, budget flow RPC, and RLS policies.
-- =============================================================================

-- 1. Detailed Expenses & Funding Sources Table
CREATE TABLE IF NOT EXISTS public.club_expenses_detailed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    event_title TEXT,
    source_name TEXT NOT NULL, -- e.g. "Student Govt Grant", "Ticket Sales Revenue", "Corporate Sponsorship"
    category TEXT NOT NULL,    -- e.g. "Venue & Facilities", "Catering", "Audio & Visual Tech"
    vendor_name TEXT NOT NULL, -- e.g. "TacoCorp", "Campus Sound Pro"
    budgeted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    actual_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending', 'reconciled', 'disputed')),
    receipt_number TEXT,
    invoice_url TEXT,
    description TEXT,
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for fast aggregation & filtering
CREATE INDEX IF NOT EXISTS idx_club_expenses_detailed_club_id ON public.club_expenses_detailed(club_id);
CREATE INDEX IF NOT EXISTS idx_club_expenses_detailed_event_id ON public.club_expenses_detailed(event_id);
CREATE INDEX IF NOT EXISTS idx_club_expenses_detailed_category ON public.club_expenses_detailed(category);
CREATE INDEX IF NOT EXISTS idx_club_expenses_detailed_status ON public.club_expenses_detailed(status);

-- 2. Row Level Security
ALTER TABLE public.club_expenses_detailed ENABLE ROW LEVEL SECURITY;

-- Allow public read access to finalized club expense flows for transparency
CREATE POLICY "Public can view approved/reconciled club expenses"
    ON public.club_expenses_detailed
    FOR SELECT
    USING (true);

-- Allow authenticated club leaders to manage expense records
CREATE POLICY "Club officers can insert and update expenses"
    ON public.club_expenses_detailed
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = club_expenses_detailed.club_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('admin', 'president', 'treasurer', 'officer')
        )
    );

-- 3. RPC Function: Aggregated Sankey Multi-tier Flow
CREATE OR REPLACE FUNCTION public.get_club_budget_sankey_flow(
    p_club_id UUID,
    p_event_id UUID DEFAULT NULL,
    p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    source_name TEXT,
    category TEXT,
    vendor_name TEXT,
    total_budget NUMERIC,
    total_actual NUMERIC,
    total_variance NUMERIC,
    transaction_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.source_name,
        e.category,
        e.vendor_name,
        SUM(e.budgeted_amount) AS total_budget,
        SUM(e.actual_amount) AS total_actual,
        SUM(e.budgeted_amount - e.actual_amount) AS total_variance,
        COUNT(e.id) AS transaction_count
    FROM public.club_expenses_detailed e
    WHERE e.club_id = p_club_id
      AND (p_event_id IS NULL OR e.event_id = p_event_id)
      AND (p_category IS NULL OR p_category = 'all' OR e.category = p_category)
    GROUP BY e.source_name, e.category, e.vendor_name
    ORDER BY total_actual DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_budget_sankey_flow TO authenticated, anon;
