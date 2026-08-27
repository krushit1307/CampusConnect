-- 1. Create crisis_interventions table
CREATE TABLE IF NOT EXISTS crisis_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    triggered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    followup_due_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '48 hours') NOT NULL,
    followup_status TEXT DEFAULT 'pending' NOT NULL CHECK (followup_status IN ('pending', 'sent', 'failed', 'opted_out')),
    followup_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for daily cron processing
CREATE INDEX IF NOT EXISTS idx_crisis_followup_due ON crisis_interventions(followup_due_at, followup_status) WHERE followup_status = 'pending';

-- Enable RLS
ALTER TABLE crisis_interventions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can trigger interventions; admins/health staff can audit
CREATE POLICY "Users can create their own crisis intervention logs"
    ON crisis_interventions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 2. Stored RPC procedure to fetch pending 48-hour follow-up interventions
CREATE OR REPLACE FUNCTION get_pending_crisis_followups()
RETURNS TABLE (
    intervention_id UUID,
    user_id UUID,
    user_email TEXT,
    full_name TEXT,
    triggered_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.id AS intervention_id,
        ci.user_id,
        u.email AS user_email,
        COALESCE(up.full_name, 'Student') AS full_name,
        ci.triggered_at
    FROM crisis_interventions ci
    JOIN auth.users u ON u.id = ci.user_id
    LEFT JOIN user_preferences up ON up.user_id = ci.user_id
    WHERE ci.followup_status = 'pending'
      AND ci.followup_due_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;