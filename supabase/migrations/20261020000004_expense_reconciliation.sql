-- =============================================================================
-- Migration: Automated Post-Event Expense Reconciliation
-- Issue: #3545 - Implement 'Automated Post-Event Expense Reconciliation'
-- Description: Adds OCR extraction columns and reconciliation status to the 
-- expenses table. Allows the system to compare uploaded receipt totals against 
-- the originally approved funding request budgets.
-- =============================================================================
CREATE TYPE reconciliation_status AS ENUM (
    'pending_ocr',
    'reconciled',
    'needs_audit',
    'failed_ocr'
);
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS receipt_image_url TEXT,
    ADD COLUMN IF NOT EXISTS ocr_vendor TEXT,
    ADD COLUMN IF NOT EXISTS ocr_amount_cents INT,
    ADD COLUMN IF NOT EXISTS ocr_date DATE,
    ADD COLUMN IF NOT EXISTS reconciliation_status reconciliation_status DEFAULT 'pending_ocr',
    ADD COLUMN IF NOT EXISTS budget_variance_pct NUMERIC DEFAULT 0;
COMMENT ON COLUMN public.expenses.receipt_image_url IS 'URL to the uploaded receipt image in Supabase Storage.';
COMMENT ON COLUMN public.expenses.ocr_amount_cents IS 'Total amount extracted from the receipt via Vision AI.';
COMMENT ON COLUMN public.expenses.budget_variance_pct IS 'Percentage difference between approved budget and actual receipt total.';
CREATE INDEX IF NOT EXISTS idx_expenses_reconciliation ON public.expenses(reconciliation_status);
-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
-- Assuming existing RLS covers basic access. We add specific policies for 
-- Student Union auditors to view all expenses regardless of club membership.
CREATE POLICY "Student Union auditors can view all expenses" ON public.expenses FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = auth.uid()
                AND role = 'student_union_auditor'
        )
    );
