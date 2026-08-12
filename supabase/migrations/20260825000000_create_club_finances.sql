-- 1. Create club_transactions table
CREATE TABLE IF NOT EXISTS club_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL, -- Positive for INCOME, negative for EXPENSE
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('INCOME', 'EXPENSE')),
    category TEXT NOT NULL, -- e.g., 'Food', 'Marketing', 'Grants', 'Ticket Sales'
    description TEXT NOT NULL,
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_club_transactions_club ON club_transactions(club_id);

-- 2. Create PostgreSQL View for real-time club balances
CREATE OR REPLACE VIEW club_financial_balances AS
SELECT 
    club_id,
    SUM(amount) AS net_balance,
    SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE 0 END) AS total_income,
    SUM(CASE WHEN transaction_type = 'EXPENSE' THEN Math.abs(amount) ELSE 0 END) AS total_expense
FROM club_transactions
GROUP BY club_id;

-- 3. Enable RLS and restrict access to Treasurers/Presidents
ALTER TABLE club_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Treasurers and Presidents can manage transactions"
ON club_transactions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM club_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.club_id = club_transactions.club_id
          AND cm.role IN ('TREASURER', 'PRESIDENT')
    )
);