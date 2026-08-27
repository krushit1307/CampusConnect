-- Migration: 20261225000000_financial_burn_rate.sql
-- Description: Implement get_club_burn_rate RPC for predictive financial modeling (#3556).

CREATE OR REPLACE FUNCTION public.get_club_burn_rate(
    p_club_id UUID
)
RETURNS TABLE (
    ledger_balance NUMERIC,
    average_monthly_burn NUMERIC,
    runway_months NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ledger_balance NUMERIC;
    v_expense_sum_90_days NUMERIC;
    v_average_monthly_burn NUMERIC;
    v_runway_months NUMERIC;
BEGIN
    -- 1. Compute ledger balance (sum of all incomes and expenses)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_ledger_balance
    FROM public.club_transactions
    WHERE club_id = p_club_id;

    -- 2. Compute absolute sum of expenses over the last 90 days
    SELECT COALESCE(SUM(ABS(amount)), 0)
    INTO v_expense_sum_90_days
    FROM public.club_transactions
    WHERE club_id = p_club_id
      AND transaction_type = 'EXPENSE'
      AND created_at >= NOW() - INTERVAL '90 days';

    -- 3. Calculate average monthly burn (over 3 months)
    v_average_monthly_burn := ROUND(v_expense_sum_90_days / 3.0, 2);

    -- 4. Calculate runway in months
    IF v_average_monthly_burn > 0 THEN
        v_runway_months := ROUND(v_ledger_balance / v_average_monthly_burn, 2);
    ELSE
        v_runway_months := 999.0; -- represents infinite runway
    END IF;

    RETURN QUERY SELECT v_ledger_balance, v_average_monthly_burn, v_runway_months;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_burn_rate(UUID) TO authenticated, service_role;
