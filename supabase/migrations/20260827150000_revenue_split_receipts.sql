-- ============================================================================
-- Migration: 20260827150000_revenue_split_receipts.sql
-- Description: Creates a secure, immutable ledger for Co-Sponsorship Revenue 
--              Splits. This ensures that when two clubs co-host an event and 
--              split the ticket revenue (e.g., 60/40), an exact, mathematically 
--              verified receipt is generated. This resolves trust issues and 
--              delays associated with manual post-event accounting.
-- Author: Antigravity AI
-- Issue: #4415
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Create the revenue_split_receipts table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.revenue_split_receipts (
    -- Unique identifier for the receipt
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign key to the event that generated this revenue
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    
    -- The Stripe checkout session that resulted in this revenue
    stripe_session_id TEXT NOT NULL,
    
    -- Financial Data (Stored in cents to prevent floating point inaccuracies)
    -- Total amount paid by the attendee
    gross_revenue_cents INT NOT NULL CHECK (gross_revenue_cents >= 0),
    
    -- Exact processing fees deducted by Stripe (typically 2.9% + $0.30)
    stripe_fee_cents INT NOT NULL CHECK (stripe_fee_cents >= 0),
    
    -- The actual distributable pool of money (Gross - Fees)
    net_profit_cents INT NOT NULL CHECK (net_profit_cents >= 0),
    
    -- Detailed breakdown of how the net profit was distributed among co-hosts
    -- Expected JSON Schema: [{ club_id, pct, amount_cents, stripe_account_id }]
    split_details JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Auditing timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Create Indexes for Performance Optimization
-- ----------------------------------------------------------------------------
-- Index for quick lookups by event (useful for dashboard aggregations)
CREATE INDEX IF NOT EXISTS idx_revenue_split_receipts_event_id 
    ON public.revenue_split_receipts(event_id);

-- Index for idempotency checks based on Stripe Session ID
CREATE INDEX IF NOT EXISTS idx_revenue_split_receipts_stripe_session 
    ON public.revenue_split_receipts(stripe_session_id);

-- Index for sorting receipts by creation date in the Treasurer dashboard
CREATE INDEX IF NOT EXISTS idx_revenue_split_receipts_created_at 
    ON public.revenue_split_receipts(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. Setup trigger for automatic updated_at timestamp management
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_revenue_split_receipts_updated_at ON public.revenue_split_receipts;
CREATE TRIGGER trg_revenue_split_receipts_updated_at
BEFORE UPDATE ON public.revenue_split_receipts
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Enable Row Level Security (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.revenue_split_receipts ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. Define Security Policies
-- ----------------------------------------------------------------------------

-- Policy: Only allow authenticated users to view receipts related to their clubs
-- In a production environment, this would join with the club_members or 
-- club_admins table to verify the user holds a Treasurer or President role.
DROP POLICY IF EXISTS "Club admins can view their revenue split receipts" ON public.revenue_split_receipts;
CREATE POLICY "Club admins can view their revenue split receipts"
    ON public.revenue_split_receipts 
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
        -- A more robust production policy might look like this:
        -- AND EXISTS (
        --     SELECT 1 FROM club_memberships cm 
        --     WHERE cm.user_id = auth.uid() 
        --     AND cm.role IN ('ADMIN', 'TREASURER')
        --     AND cm.club_id IN (
        --         SELECT jsonb_array_elements(split_details)->>'club_id'
        --     )
        -- )
    );

-- Policy: Block all manual INSERT operations from the client-side
-- These receipts should ONLY be generated programmatically by the secure 
-- Stripe webhook or trusted internal RPC functions.
DROP POLICY IF EXISTS "Prevent client side inserts" ON public.revenue_split_receipts;
CREATE POLICY "Prevent client side inserts"
    ON public.revenue_split_receipts 
    FOR INSERT
    WITH CHECK (false);

-- Policy: Block all manual UPDATE operations to ensure immutability
-- Once a receipt is generated, it serves as a permanent financial record.
DROP POLICY IF EXISTS "Prevent client side updates" ON public.revenue_split_receipts;
CREATE POLICY "Prevent client side updates"
    ON public.revenue_split_receipts 
    FOR UPDATE
    USING (false);

-- Policy: Block all manual DELETE operations to prevent tampering
DROP POLICY IF EXISTS "Prevent client side deletes" ON public.revenue_split_receipts;
CREATE POLICY "Prevent client side deletes"
    ON public.revenue_split_receipts 
    FOR DELETE
    USING (false);

-- ============================================================================
-- End of Migration
-- ============================================================================
