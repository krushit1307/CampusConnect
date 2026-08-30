-- 1. Create expected_transactions table for forward-looking financial planning
CREATE TABLE IF NOT EXISTS expected_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    projected_date DATE NOT NULL,
    category TEXT DEFAULT 'general' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for chronological time-series balance queries
CREATE INDEX IF NOT EXISTS idx_expected_tx_club_date ON expected_transactions(club_id, projected_date ASC);

-- Enable RLS
ALTER TABLE expected_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Club Treasurers and Officers can manage expected transactions
CREATE POLICY "Club treasurers can manage expected transactions"
    ON expected_transactions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM club_memberships cm
            WHERE cm.club_id = expected_transactions.club_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('treasurer', 'president', 'officer', 'admin')
        )
    );