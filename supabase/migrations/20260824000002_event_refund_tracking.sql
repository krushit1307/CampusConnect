-- Migration: 20260824000002_event_refund_tracking.sql
-- Purpose: Add tracking table for partial refunds to ensure idempotency and auditability.

CREATE TABLE IF NOT EXISTS event_refunds (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    payment_intent_id TEXT NOT NULL,
    original_amount INTEGER NOT NULL,
    refunded_amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup of refunds by event
CREATE INDEX IF NOT EXISTS idx_event_refunds_event_id 
ON event_refunds(event_id);

-- Index for idempotency checks on payment intents
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_refunds_payment_intent 
ON event_refunds(payment_intent_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_refunds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_event_refunds_updated_at ON event_refunds;
CREATE TRIGGER update_event_refunds_updated_at
BEFORE UPDATE ON event_refunds
FOR EACH ROW
EXECUTE FUNCTION update_event_refunds_updated_at();
