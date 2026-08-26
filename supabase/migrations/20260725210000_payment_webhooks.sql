-- Migration: 20260725210000_payment_webhooks.sql
-- Description: Create idempotency processed_webhooks table and add status column to event_rsvps.

-- 1. Create processed_webhooks table for idempotency key storage
CREATE TABLE IF NOT EXISTS public.processed_webhooks (
    event_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;

-- Allow only service_role to manage processed_webhooks
CREATE POLICY "Service role has full access to processed webhooks" 
ON public.processed_webhooks 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- 2. Add status column to event_rsvps table
ALTER TABLE public.event_rsvps ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';

-- Drop constraint if it already exists to avoid errors, then recreate
ALTER TABLE public.event_rsvps DROP CONSTRAINT IF EXISTS check_rsvp_status;

ALTER TABLE public.event_rsvps ADD CONSTRAINT check_rsvp_status 
CHECK (status IN ('PENDING', 'PAID', 'FREE'));
