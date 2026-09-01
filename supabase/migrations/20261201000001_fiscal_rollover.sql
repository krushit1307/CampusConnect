-- =============================================================================
-- Migration: Automated Club Budget Roll-over Logic
-- Issue: #4036 - Implement 'Automated Club Budget Roll-over' Logic
-- Description: Adds fiscal year configuration and ensures club ledgers can 
-- be processed for end-of-year reclamation, logging all debit transactions.
-- =============================================================================
-- 1. Global Fiscal Configuration
CREATE TABLE IF NOT EXISTS public.fiscal_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fiscal_year_end_date DATE NOT NULL,
    max_rollover_percentage NUMERIC(5, 2) NOT NULL DEFAULT 20.00 CHECK (
        max_rollover_percentage >= 0
        AND max_rollover_percentage <= 100
    ),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.fiscal_config (fiscal_year_end_date, max_rollover_percentage)
VALUES ('2026-06-30', 20.00) ON CONFLICT DO NOTHING;
-- 2. Ensure club_ledgers and transactions tables have necessary structure
-- (Assuming public.club_ledgers and public.transactions exist from prior migrations)
-- We add a specific transaction_type for rollovers if not present.
ALTER TYPE transaction_type
ADD VALUE IF NOT EXISTS 'fiscal_reclamation';
-- 3. RPC: Execute the fiscal rollover for a specific club
CREATE OR REPLACE FUNCTION public.execute_club_rollover(p_club_id UUID) RETURNS TABLE (
        club_id UUID,
        initial_balance NUMERIC,
        initial_allocation NUMERIC,
        allowed_rollover NUMERIC,
        reclaimed_amount NUMERIC,
        new_balance NUMERIC
    ) AS $$
DECLARE v_balance NUMERIC;
v_allocation NUMERIC;
v_max_pct NUMERIC;
v_allowed NUMERIC;
v_reclaimed NUMERIC;
v_new_balance NUMERIC;
BEGIN -- Fetch config
SELECT max_rollover_percentage INTO v_max_pct
FROM public.fiscal_config
WHERE is_active = TRUE
LIMIT 1;
IF v_max_pct IS NULL THEN v_max_pct := 20.00;
END IF;
-- Fetch current ledger state
SELECT balance,
    initial_allocation INTO v_balance,
    v_allocation
FROM public.club_ledgers
WHERE club_id = p_club_id FOR
UPDATE;
IF v_balance IS NULL THEN v_balance := 0;
v_allocation := 0;
END IF;
-- Calculate limits
v_allowed := ROUND(v_allocation * (v_max_pct / 100.0), 2);
IF v_balance > v_allowed THEN v_reclaimed := v_balance - v_allowed;
v_new_balance := v_allowed;
-- Insert the reclamation debit transaction
INSERT INTO public.transactions (
        club_id,
        amount,
        transaction_type,
        description,
        created_at
    )
VALUES (
        p_club_id,
        - v_reclaimed,
        'fiscal_reclamation',
        'End of Year Fiscal Reclamation (Max 20% rollover)',
        NOW()
    );
ELSE v_reclaimed := 0;
v_new_balance := v_balance;
END IF;
-- Update ledger
UPDATE public.club_ledgers
SET balance = v_new_balance,
    updated_at = NOW()
WHERE club_id = p_club_id;
RETURN QUERY
SELECT p_club_id,
    v_balance,
    v_allocation,
    v_allowed,
    v_reclaimed,
    v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
