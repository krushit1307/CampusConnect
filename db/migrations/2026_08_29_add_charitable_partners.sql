-- Migration: Add CharitablePartner and ComplianceCheck tables
-- Issue #4993: Automated "Club Spending" IRS 990 Filer Tracker
-- Created: 2026-08-29

-- Enum for partner compliance status
CREATE TYPE compliance_status AS ENUM (
  'active',        -- Fully compliant, transfers allowed
  'pending_review', -- Initial registration, awaiting first check
  'non_compliant', -- Failed compliance check, transfers blocked
  'revoked'        -- IRS revoked 501(c)(3) status, transfers blocked
);

-- CharitablePartner: External non-profit entities registered as partners
CREATE TABLE charitable_partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  ein TEXT NOT NULL UNIQUE,  -- Employer Identification Number (9 digits)
  ein_normalized TEXT NOT NULL UNIQUE,  -- Stripped of hyphens for matching
  email TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  contact_person TEXT,
  
  -- Compliance tracking
  compliance_status compliance_status DEFAULT 'pending_review',
  last_verified_at TIMESTAMP WITH TIME ZONE,
  next_verification_at TIMESTAMP WITH TIME ZONE,
  revocation_date DATE,
  last_filing_date DATE,
  
  -- Registration metadata
  registered_by TEXT NOT NULL,  -- User ID who registered the partner
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Soft delete
  is_active BOOLEAN DEFAULT true NOT NULL
);

-- Index for compliance checks
CREATE INDEX idx_charitable_partners_compliance_status ON charitable_partners(compliance_status);
CREATE INDEX idx_charitable_partners_ein ON charitable_partners(ein_normalized);
CREATE INDEX idx_charitable_partners_next_verification ON charitable_partners(next_verification_at) 
  WHERE is_active = true AND compliance_status != 'revoked';

-- ComplianceCheck: Audit trail of IRS API checks
CREATE TABLE compliance_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES charitable_partners(id) ON DELETE CASCADE,
  
  -- Check results
  check_type TEXT NOT NULL DEFAULT 'monthly',  -- 'monthly', 'manual', 'registration'
  status TEXT NOT NULL,  -- 'pass', 'fail', 'error', 'pending'
  
  -- IRS API response data
  irs_filing_status TEXT,  -- Current filing status from IRS
  last_990_filed_date DATE,
  revocation_date DATE,
  revocation_reason TEXT,
  
  -- Raw API response (for debugging/audit)
  irs_response JSONB,
  
  -- Error tracking
  error_message TEXT,
  
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  checked_by TEXT DEFAULT 'system'  -- 'system' for cron, user ID for manual
);

-- Index for compliance history queries
CREATE INDEX idx_compliance_checks_partner_id ON compliance_checks(partner_id);
CREATE INDEX idx_compliance_checks_checked_at ON compliance_checks(checked_at DESC);
CREATE INDEX idx_compliance_checks_status ON compliance_checks(status);

-- PartnerLedgerLock: Track when partners are locked and why
CREATE TABLE partner_ledger_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES charitable_partners(id) ON DELETE CASCADE,
  
  lock_reason TEXT NOT NULL,  -- 'non_compliant', 'revoked', 'manual'
  locked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  locked_by TEXT NOT NULL,  -- User ID or 'system'
  
  unlocked_at TIMESTAMP WITH TIME ZIRast,
  unlocked_by TEXT,
  unlock_reason TEXT,
  
  -- Whether the lock is currently active
  is_active BOOLEAN DEFAULT true NOT NULL
);

-- Index for active locks
CREATE INDEX idx_partner_ledger_locks_partner_id ON partner_ledger_locks(partner_id);
CREATE INDEX idx_partner_ledger_locks_active ON partner_ledger_locks(is_active) 
  WHERE is_active = true;

-- Add partner_id to club_transactions (if not exists)
-- This links transactions to charitable partners for compliance tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'club_transactions' AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE club_transactions 
      ADD COLUMN partner_id UUID REFERENCES charitable_partners(id) ON DELETE SET NULL;
    
    CREATE INDEX idx_club_transactions_partner_id ON club_transactions(partner_id);
  END IF;
END $$;

-- View for partners needing verification
CREATE OR REPLACE VIEW partners_needing_verification AS
SELECT 
  cp.id,
  cp.name,
  cp.ein,
  cp.compliance_status,
  cp.last_verified_at,
  cp.next_verification_at,
  cp.revocation_date,
  cp.last_filing_date,
  EXTRACT(DAY FROM NOW() - cp.last_verified_at) AS days_since_last_check
FROM charitable_partners cp
WHERE cp.is_active = true
  AND cp.compliance_status != 'revoked'
  AND (
    cp.next_verification_at IS NULL 
    OR cp.next_verification_at <= NOW()
  );

-- View for locked partners (for dashboard display)
CREATE OR REPLACE VIEW locked_partners AS
SELECT 
  cp.id,
  cp.name,
  cp.ein,
  cp.compliance_status,
  pll.lock_reason,
  pll.locked_at,
  pll.locked_by
FROM charitable_partners cp
JOIN partner_ledger_locks pll ON pll.partner_id = cp.id
WHERE pll.is_active = true;
