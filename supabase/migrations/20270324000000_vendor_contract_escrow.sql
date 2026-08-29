-- =============================================================================
-- Migration: Vendor contract escrow stages
-- Issue: #4423 - Interactive "Vendor Bidding" Escrow Viewer
-- Adds amount and transition timestamps so the escrow tracker can map who
-- currently holds contracted funds.
-- =============================================================================

ALTER TABLE public.vendor_contracts
  ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escrow_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vendor_contracts.amount IS
  'Accepted bid amount in dollars held through the club ledger / Stripe escrow flow.';
COMMENT ON COLUMN public.vendor_contracts.escrow_locked_at IS
  'When funds moved from the club ledger into platform escrow.';
COMMENT ON COLUMN public.vendor_contracts.released_at IS
  'When escrowed funds were released to the vendor after QR check-in.';
