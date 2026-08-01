-- =============================================================================
-- Migration: Create idempotency_keys table for payment processing
-- Purpose: Prevent double-charging by caching payment request states
-- TTL: 24 hours (handled via application logic or pg_cron if available)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    request_hash VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
    response_payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Index for fast lookups by key
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON public.idempotency_keys(key);

-- Index for cleanup of expired keys
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON public.idempotency_keys(expires_at);

-- Row Level Security (RLS)
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Only service role or authenticated users with specific claims can manage these
CREATE POLICY "Allow service role to manage idempotency keys"
    ON public.idempotency_keys
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Function to clean up expired keys (can be called via pg_cron or edge function)
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS void AS $$
BEGIN
    DELETE FROM public.idempotency_keys
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;