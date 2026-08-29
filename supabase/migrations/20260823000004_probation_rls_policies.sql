-- Migration: 20260823000004_probation_rls_policies.sql
-- Purpose: Enforce Row Level Security to block actions for clubs on probation.

-- Enable RLS on events and ledger_transactions if not already enabled
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Block event creation for probation clubs" ON events;
DROP POLICY IF EXISTS "Block ledger withdrawals for probation clubs" ON ledger_transactions;

-- Policy 1: Block INSERTs to the events table if the club is on probation
CREATE POLICY "Block event creation for probation clubs"
ON events
FOR INSERT
TO authenticated
WITH CHECK (
    NOT EXISTS (
        SELECT 1 FROM clubs 
        WHERE clubs.id = events.club_id 
        AND clubs.status = 'probation'
    )
);

-- Policy 2: Block withdraws (negative amounts) from the ledgers table if the club is on probation
CREATE POLICY "Block ledger withdrawals for probation clubs"
ON ledger_transactions
FOR INSERT
TO authenticated
WITH CHECK (
    NOT EXISTS (
        SELECT 1 FROM clubs 
        WHERE clubs.id = ledger_transactions.club_id 
        AND clubs.status = 'probation'
    )
    OR ledger_transactions.amount >= 0 -- Allow deposits, block withdrawals
);
