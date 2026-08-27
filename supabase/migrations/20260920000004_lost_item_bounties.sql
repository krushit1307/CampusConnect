-- =============================================================================
-- Migration: Interactive Lost Item Bounty System
-- Issue: #3318 - Implement 'Interactive Lost Item Bounty' System
-- Description: Adds bounty columns to the lost_items table and creates a 
-- disputes table for escalation. Integrates with Stripe Connect for escrow.
-- =============================================================================
-- 1. Add bounty columns to lost_items table
ALTER TABLE public.lost_items
ADD COLUMN IF NOT EXISTS bounty_amount_cents INT DEFAULT 0 CHECK (bounty_amount_cents >= 0),
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
    ADD COLUMN IF NOT EXISTS bounty_status TEXT DEFAULT 'none' CHECK (
        bounty_status IN (
            'none',
            'escrow',
            'released',
            'refunded',
            'disputed'
        )
    ),
    ADD COLUMN IF NOT EXISTS finder_user_id UUID REFERENCES auth.users(id) ON DELETE
SET NULL,
    ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
COMMENT ON COLUMN public.lost_items.bounty_amount_cents IS 'The monetary reward offered in cents.';
COMMENT ON COLUMN public.lost_items.bounty_status IS 'Tracks the lifecycle of the escrowed funds.';
-- 2. Bounty Disputes Table
-- Used when a finder claims to have returned the item but the loser refuses to release funds
CREATE TABLE IF NOT EXISTS public.bounty_disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lost_item_id UUID NOT NULL REFERENCES public.lost_items(id) ON DELETE CASCADE,
    raised_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    evidence_urls TEXT [] NOT NULL DEFAULT '{}',
    -- Photos of the handover
    status TEXT NOT NULL DEFAULT 'open' CHECK (
        status IN ('open', 'resolved_finder', 'resolved_loser')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE
    SET NULL -- Admin who resolved it
);
CREATE INDEX IF NOT EXISTS idx_bounty_disputes_item ON public.bounty_disputes(lost_item_id);
-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.bounty_disputes ENABLE ROW LEVEL SECURITY;
-- Users involved in the dispute (finder or loser) can view it
CREATE POLICY "Users can view relevant disputes" ON public.bounty_disputes FOR
SELECT USING (
        raised_by = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.lost_items li
            WHERE li.id = bounty_disputes.lost_item_id
                AND (
                    li.user_id = auth.uid()
                    OR li.finder_user_id = auth.uid()
                )
        )
    );
-- Only the finder can raise a dispute
CREATE POLICY "Finders can raise disputes" ON public.bounty_disputes FOR
INSERT WITH CHECK (
        raised_by = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.lost_items li
            WHERE li.id = bounty_disputes.lost_item_id
                AND li.finder_user_id = auth.uid()
                AND li.bounty_status = 'escrow'
        )
    );
-- Only admins can resolve disputes (handled via Edge Function with Service Role)
CREATE POLICY "Admins can resolve disputes" ON public.bounty_disputes FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = auth.uid()
                AND role = 'admin'
        )
    );
