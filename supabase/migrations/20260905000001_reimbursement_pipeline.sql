-- =============================================================================
-- Migration: Automated Reimbursement Processing via Stripe
-- Issue: #3227 - Implement 'Automated Reimbursement Processing' via Stripe
-- Description: Creates the schema for managing club expense reimbursements.
-- Includes tables for Stripe Connect accounts, reimbursement requests, and 
-- dual-approval workflows. Enforces strict RLS policies to ensure only 
-- authorized club executives can approve payouts.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Stripe Connect Accounts Table
-- Maps internal users to their external Stripe Connect accounts for payouts
CREATE TABLE IF NOT EXISTS public.stripe_accounts (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_connect_account_id TEXT NOT NULL UNIQUE,
    is_charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_accounts_connect_id 
ON public.stripe_accounts(stripe_connect_account_id);

-- 2. Expense Reimbursements Table
CREATE TYPE reimbursement_status AS ENUM (
    'pending', 
    'approved_treasurer', 
    'approved_dual', 
    'processing', 
    'paid', 
    'rejected'
);

CREATE TABLE IF NOT EXISTS public.expense_reimbursements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount_cents INT NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    description TEXT NOT NULL CHECK (char_length(description) >= 10),
    receipt_url TEXT NOT NULL,
    status reimbursement_status NOT NULL DEFAULT 'pending',
    
    -- Dual Approval Tracking
    treasurer_approval_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    treasurer_approved_at TIMESTAMPTZ,
    president_approval_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    president_approved_at TIMESTAMPTZ,
    
    -- Stripe Transfer Details
    stripe_transfer_id TEXT,
    failure_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reimbursements_club_status 
ON public.expense_reimbursements(club_id, status);
CREATE INDEX IF NOT EXISTS idx_reimbursements_user 
ON public.expense_reimbursements(user_id);

-- =============================================================================
-- Helper Function: Check Dual Approval Requirement
-- =============================================================================
CREATE OR REPLACE FUNCTION public.requires_dual_approval(p_amount_cents INT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Any reimbursement over $100.00 (10000 cents) requires dual approval
    RETURN p_amount_cents > 10000;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_reimbursements ENABLE ROW LEVEL SECURITY;

-- Stripe Accounts RLS
CREATE POLICY "Users can view and manage own Stripe account"
ON public.stripe_accounts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Treasurers/Presidents need to read Stripe status to verify payouts are enabled
CREATE POLICY "Club admins can view member Stripe status"
ON public.stripe_accounts FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        JOIN public.expense_reimbursements er ON cm.club_id = er.club_id
        WHERE cm.user_id = auth.uid() 
        AND cm.role IN ('admin', 'treasurer', 'president')
        AND er.user_id = stripe_accounts.user_id
    )
);

-- Reimbursements RLS
-- Users can view and insert their own reimbursement requests
CREATE POLICY "Users can manage own reimbursements"
ON public.expense_reimbursements FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Club Treasurers and Presidents can view and update all club reimbursements
CREATE POLICY "Club executives can manage club reimbursements"
ON public.expense_reimbursements FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = expense_reimbursements.club_id 
        AND cm.user_id = auth.uid() 
        AND cm.role IN ('admin', 'treasurer', 'president')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = expense_reimbursements.club_id 
        AND cm.user_id = auth.uid() 
        AND cm.role IN ('admin', 'treasurer', 'president')
    )
);
