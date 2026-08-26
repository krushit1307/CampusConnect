-- =============================================================================
-- Migration: Automated "Club Transition" Document Vault
-- Issue: #4051 - Implement 'Automated "Club Transition" Document Vault'
-- Description: Creates a secure vault for outgoing leadership to store 
-- encrypted credentials, unlocking automatically for incoming leadership 
-- on a specific date, with an immutable audit trail.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Transition Vaults Table
CREATE TABLE IF NOT EXISTS public.transition_vaults (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  encrypted_payload TEXT NOT NULL, -- AES-256 encrypted JSON
  iv TEXT NOT NULL, -- Initialization Vector
  unlock_date DATE NOT NULL,
  unlocked_by_role TEXT NOT NULL DEFAULT 'president',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Immutable Audit Trail
CREATE TABLE IF NOT EXISTS public.vault_access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vault_id UUID NOT NULL REFERENCES public.transition_vaults(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'accessed', 'decrypted')),
  ip_address INET,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vaults_club ON public.transition_vaults(club_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_vault ON public.vault_access_logs(vault_id);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.transition_vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_access_logs ENABLE ROW LEVEL SECURITY;

-- Outgoing/Incoming Presidents can view their club's vault
CREATE POLICY "Club presidents can view vaults"
ON public.transition_vaults FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = transition_vaults.club_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'president'
  )
);

-- Only current president can create/update
CREATE POLICY "Current president can manage vaults"
ON public.transition_vaults FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = transition_vaults.club_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'president'
  )
);

-- Users can only see their own access logs
CREATE POLICY "Users view own access logs"
ON public.vault_access_logs FOR SELECT
USING (auth.uid() = user_id);

-- System inserts access logs
CREATE POLICY "System logs access"
ON public.vault_access_logs FOR INSERT
WITH CHECK (auth.role() = 'service_role');
