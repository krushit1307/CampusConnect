-- Add Stripe Connect onboarding fields to clubs table
ALTER TABLE clubs 
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT FALSE NOT NULL;

-- Index for fast lookups on connected Stripe accounts
CREATE INDEX IF NOT EXISTS idx_clubs_stripe_account ON clubs(stripe_account_id);