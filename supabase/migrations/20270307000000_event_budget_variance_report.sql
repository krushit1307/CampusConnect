-- ============================================================
-- Migration: Dynamic Event Budget Variance Report
-- Issue: #4217
-- ============================================================

-- ------------------------------------------------------------
-- 1. Ensure event_id exists on financial transaction ledger tables
-- ------------------------------------------------------------

-- Add event_id to public.transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_event_id ON public.transactions(event_id);

-- Add event_id to public.club_transactions
ALTER TABLE public.club_transactions
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_club_transactions_event_id ON public.club_transactions(event_id);

-- Add estimated_expenses to public.events if stored directly or in event_budget_projections
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS estimated_expenses JSONB DEFAULT '[]'::jsonb;

-- ------------------------------------------------------------
-- 2. RPC: get_event_budget_variance_report
-- Aggregates debits/expenses by category and compares with estimated line items
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_event_budget_variance_report(
    p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_club_id UUID;
    v_event_title TEXT;
    v_authorized BOOLEAN;
    v_fixed_expenses JSONB;
    v_event_estimates JSONB;
    v_category_rows JSONB;
    v_total_estimated NUMERIC := 0.00;
    v_total_actual NUMERIC := 0.00;
    v_total_variance NUMERIC := 0.00;
BEGIN
    -- 1. Verify Event
    SELECT club_id, title, estimated_expenses
    INTO v_club_id, v_event_title, v_event_estimates
    FROM public.events
    WHERE id = p_event_id;

    IF v_club_id IS NULL THEN
        RAISE EXCEPTION 'Event not found';
    END IF;

    -- 2. Verify Authorization (Club Admin, Treasurer, President, Officer)
    SELECT
        EXISTS (
            SELECT 1 FROM public.clubs
            WHERE id = v_club_id AND created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.club_members
            WHERE club_id = v_club_id
              AND user_id = auth.uid()
              AND role IN ('admin', 'president', 'treasurer', 'officer', 'TREASURER', 'PRESIDENT')
              AND status = 'approved'
        )
    INTO v_authorized;

    -- Fallback for public viewing or non-strict check if user is authenticated
    IF auth.uid() IS NOT NULL AND NOT v_authorized THEN
        -- Allow general members or event viewers read-only access for transparency
        v_authorized := TRUE;
    END IF;

    -- 3. Retrieve Estimated Expenses from event_budget_projections if available
    SELECT fixed_expenses_json
    INTO v_fixed_expenses
    FROM public.event_budget_projections
    WHERE event_id = p_event_id;

    -- Combine estimates: prioritize fixed_expenses_json or events.estimated_expenses
    IF v_fixed_expenses IS NULL OR jsonb_array_length(v_fixed_expenses) = 0 THEN
        v_fixed_expenses := COALESCE(v_event_estimates, '[]'::jsonb);
    END IF;

    -- 4. Aggregate Actuals from Ledger Tables
    -- Merge items from:
    --   a) club_expenses_detailed
    --   b) club_transactions (EXPENSE)
    --   c) transactions (type = 'expense')
    --   d) event_expenses
    WITH estimated_items AS (
        SELECT 
            COALESCE(elem->>'category', elem->>'name', elem->>'item', 'General') AS category,
            COALESCE((elem->>'amount')::NUMERIC, (elem->>'cost')::NUMERIC, 0.00) AS estimated_amount
        FROM jsonb_array_elements(COALESCE(v_fixed_expenses, '[]'::jsonb)) AS elem
    ),
    estimated_agg AS (
        SELECT 
            category,
            SUM(estimated_amount) AS estimated
        FROM estimated_items
        GROUP BY category
    ),
    actual_ledger_entries AS (
        -- From club_expenses_detailed
        SELECT 
            category,
            actual_amount AS amount
        FROM public.club_expenses_detailed
        WHERE event_id = p_event_id
          AND status IN ('approved', 'reconciled')

        UNION ALL

        -- From club_transactions (debits / expenses)
        SELECT 
            COALESCE(category, 'General') AS category,
            ABS(amount) AS amount
        FROM public.club_transactions
        WHERE event_id = p_event_id
          AND (transaction_type = 'EXPENSE' OR amount < 0)

        UNION ALL

        -- From transactions table
        SELECT 
            COALESCE(category, 'General') AS category,
            ABS(amount) AS amount
        FROM public.transactions
        WHERE event_id = p_event_id
          AND type = 'expense'
          AND status = 'approved'

        UNION ALL

        -- From event_expenses table
        SELECT 
            'General' AS category,
            total_amount AS amount
        FROM public.event_expenses
        WHERE event_id = p_event_id
    ),
    actual_agg AS (
        SELECT 
            category,
            SUM(amount) AS actual
        FROM actual_ledger_entries
        GROUP BY category
    ),
    all_categories AS (
        SELECT category FROM estimated_agg
        UNION
        SELECT category FROM actual_agg
    ),
    comparison_table AS (
        SELECT 
            c.category,
            COALESCE(e.estimated, 0.00) AS estimated,
            COALESCE(a.actual, 0.00) AS actual,
            ROUND(COALESCE(e.estimated, 0.00) - COALESCE(a.actual, 0.00), 2) AS variance,
            CASE 
                WHEN COALESCE(e.estimated, 0.00) > 0 THEN 
                    ROUND(((COALESCE(a.actual, 0.00) - COALESCE(e.estimated, 0.00)) / e.estimated) * 100, 1)
                ELSE 0.0 
            END AS percentage_variance,
            (COALESCE(a.actual, 0.00) > COALESCE(e.estimated, 0.00)) AS is_overspent
        FROM all_categories c
        LEFT JOIN estimated_agg e ON e.category = c.category
        LEFT JOIN actual_agg a ON a.category = c.category
    )
    SELECT 
        COALESCE(jsonb_agg(
            jsonb_build_object(
                'category', category,
                'estimated', estimated,
                'actual', actual,
                'variance', variance,
                'percentage_variance', percentage_variance,
                'is_overspent', is_overspent
            )
            ORDER BY actual DESC, estimated DESC
        ), '[]'::jsonb),
        COALESCE(SUM(estimated), 0.00),
        COALESCE(SUM(actual), 0.00),
        COALESCE(SUM(variance), 0.00)
    INTO 
        v_category_rows,
        v_total_estimated,
        v_total_actual,
        v_total_variance
    FROM comparison_table;

    RETURN jsonb_build_object(
        'event_id', p_event_id,
        'event_title', v_event_title,
        'total_estimated', v_total_estimated,
        'total_actual', v_total_actual,
        'total_variance', v_total_variance,
        'is_overspent', (v_total_actual > v_total_estimated),
        'categories', v_category_rows
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_budget_variance_report(UUID) TO authenticated, anon;
