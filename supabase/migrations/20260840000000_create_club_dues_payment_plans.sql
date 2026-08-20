-- 1. Add allow_installments flag and installment config to club_dues table
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS dues_amount NUMERIC(10,2) DEFAULT 0.00 NOT NULL,
ADD COLUMN IF NOT EXISTS allow_installments BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS installment_count INTEGER DEFAULT 6 NOT NULL;

-- 2. Create club_dues_payment_plans table to track active installment schedules
CREATE TABLE IF NOT EXISTS club_dues_payment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    installment_amount NUMERIC(10,2) NOT NULL,
    total_installments INTEGER NOT NULL,
    completed_installments INTEGER DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'PAST_DUE', 'CANCELED')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(club_id, user_id)
);

-- Index for lookup queries
CREATE INDEX IF NOT EXISTS idx_dues_payment_plans_user ON club_dues_payment_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_dues_payment_plans_stripe ON club_dues_payment_plans(stripe_subscription_id);

-- Enable RLS
ALTER TABLE club_dues_payment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payment plans"
    ON club_dues_payment_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Treasurers can view club payment plans"
    ON club_dues_payment_plans FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM club_members cm
            WHERE cm.user_id = auth.uid()
              AND cm.club_id = club_dues_payment_plans.club_id
              AND cm.role IN ('TREASURER', 'PRESIDENT')
        )
    );