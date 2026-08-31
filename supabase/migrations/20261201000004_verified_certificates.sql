-- =============================================================================
-- Migration: Automated "Event Series" Certificate Generation
-- Issue: #4048 - Implement 'Automated "Event Series" Certificate Generation'
-- Description: Creates a table to store cryptographically verified certificates 
-- issued upon 100% completion of an event series, including a unique hash.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.verified_certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id UUID NOT NULL, -- References the event series definition
  series_name TEXT NOT NULL,
  user_name TEXT NOT NULL,
  completion_date DATE NOT NULL,
  verification_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of id + user_id + series_id
  pdf_url TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON public.verified_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_hash ON public.verified_certificates(verification_hash);

COMMENT ON COLUMN public.verified_certificates.verification_hash IS 
  'Cryptographic hash used to verify the certificate authenticity on the public verification page.';

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.verified_certificates ENABLE ROW LEVEL SECURITY;

-- Users can view their own certificates
CREATE POLICY "Users view own certificates"
ON public.verified_certificates FOR SELECT
USING (auth.uid() = user_id);

-- Public can verify a certificate by its hash (no user_id check needed for verification)
CREATE POLICY "Public can verify certificates by hash"
ON public.verified_certificates FOR SELECT
USING (true);

-- System (Edge Functions) can insert certificates
CREATE POLICY "System can issue certificates"
ON public.verified_certificates FOR INSERT
WITH CHECK (auth.role() = 'service_role');
