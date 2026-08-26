-- ============================================================
-- Migration: 20260730190000_club_budget_materialized_view.sql
-- Description: Creates budgets + transactions tables, materialized view
--              for club financial summary, and hourly pg_cron refresh.
-- Issue #1912: Postgres materialized view for Club Budget aggregation
-- ============================================================

-- 1. Enum for transaction type
DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('income', 'expense');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. budgets table — annual/periodic fund allocation for each club
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  total_allocated NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(club_id, fiscal_year)
);

-- 3. transactions table — individual income/expense entries per club
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  status transaction_status NOT NULL DEFAULT 'approved',
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_budgets_club_id ON public.budgets(club_id);
CREATE INDEX IF NOT EXISTS idx_transactions_club_id ON public.transactions(club_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(club_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(club_id, type);

-- 5. Enable RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for budgets
CREATE POLICY "Budgets are viewable by club members and admins"
  ON public.budgets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = budgets.club_id
        AND user_id = auth.uid()
        AND status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "Budgets are manageable by club admins"
  ON public.budgets FOR INSERT
  WITH CHECK (
    public.is_club_admin(budgets.club_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "Budgets updatable by club admins"
  ON public.budgets FOR UPDATE
  USING (
    public.is_club_admin(budgets.club_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- 7. RLS policies for transactions
CREATE POLICY "Transactions are viewable by club members and admins"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = transactions.club_id
        AND user_id = auth.uid()
        AND status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "Transactions are manageable by club admins"
  ON public.transactions FOR INSERT
  WITH CHECK (
    public.is_club_admin(transactions.club_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "Transactions updatable by club admins"
  ON public.transactions FOR UPDATE
  USING (
    public.is_club_admin(transactions.club_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- 8. Materialized View: club_financial_summary
-- Aggregates budget totals and transaction sums per club
CREATE MATERIALIZED VIEW IF NOT EXISTS public.club_financial_summary AS
SELECT
  c.id AS club_id,
  c.name AS club_name,
  COALESCE(b.total_allocated, 0) AS total_budget,
  COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status = 'approved' THEN t.amount ELSE 0 END), 0) AS total_income,
  COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'approved' THEN t.amount ELSE 0 END), 0) AS total_expenses,
  COALESCE(b.total_allocated, 0)
    + COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status = 'approved' THEN t.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'approved' THEN t.amount ELSE 0 END), 0) AS remaining_balance,
  COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'approved' THEN 1 ELSE 0 END), 0)::bigint AS transaction_count,
  NOW() AS refreshed_at
FROM public.clubs c
LEFT JOIN public.budgets b ON b.club_id = c.id
LEFT JOIN public.transactions t ON t.club_id = c.id
GROUP BY c.id, c.name, b.total_allocated;

-- 9. Unique index for CONCURRENTLY refresh support
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_financial_summary_club_id
  ON public.club_financial_summary (club_id);

-- 10. Grant permissions
GRANT SELECT ON public.club_financial_summary TO authenticated, anon;
GRANT SELECT ON public.budgets TO authenticated;
GRANT SELECT ON public.transactions TO authenticated;

-- 11. RPC: Get financial summary for a club
CREATE OR REPLACE FUNCTION public.get_club_financial_summary(p_club_id UUID)
RETURNS TABLE (
  club_id UUID,
  club_name TEXT,
  total_budget NUMERIC,
  total_income NUMERIC,
  total_expenses NUMERIC,
  remaining_balance NUMERIC,
  transaction_count BIGINT,
  refreshed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    fs.club_id,
    fs.club_name,
    fs.total_budget,
    fs.total_income,
    fs.total_expenses,
    fs.remaining_balance,
    fs.transaction_count,
    fs.refreshed_at
  FROM public.club_financial_summary fs
  WHERE fs.club_id = p_club_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_financial_summary(UUID) TO authenticated;

-- 12. RPC: Get recent transactions for a club
CREATE OR REPLACE FUNCTION public.get_club_transactions(
  p_club_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  amount NUMERIC,
  description TEXT,
  category TEXT,
  status TEXT,
  transaction_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    t.id,
    t.type::TEXT,
    t.amount,
    t.description,
    t.category,
    t.status::TEXT,
    t.transaction_date,
    t.created_at
  FROM public.transactions t
  WHERE t.club_id = p_club_id
  ORDER BY t.transaction_date DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_transactions(UUID, INT, INT) TO authenticated;

-- 13. Schedule pg_cron job to refresh every hour
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh_club_financial_summary',
      '0 * * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.club_financial_summary;'
    );
    RAISE NOTICE 'Scheduled hourly refresh for club_financial_summary.';
  ELSE
    RAISE NOTICE 'pg_cron extension not active; skipping cron schedule.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available; skipping cron schedule.';
END $$;
