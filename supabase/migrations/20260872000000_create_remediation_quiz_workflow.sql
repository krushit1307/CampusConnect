-- 1. Extend user_preferences to support remediation workflow state and strike tracking
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'active' NOT NULL 
    CHECK (moderation_status IN ('active', 'shadowbanned', 'remediation_required', 'permanently_banned')),
ADD COLUMN IF NOT EXISTS active_moderation_strikes INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS last_violation_category TEXT;

-- 2. Create moderation_quiz_attempts table
CREATE TABLE IF NOT EXISTS moderation_quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    violation_category TEXT NOT NULL,
    score_percentage NUMERIC(5, 2) NOT NULL,
    passed BOOLEAN NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for remediation state lookups
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON moderation_quiz_attempts(user_id);

-- Enable RLS
ALTER TABLE moderation_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view and submit their own quiz attempts
CREATE POLICY "Users can manage their own remediation quiz attempts"
    ON moderation_quiz_attempts FOR ALL
    USING (auth.uid() = user_id);

-- Stored RPC procedure to process 100% quiz completion and reinstate account
CREATE OR REPLACE FUNCTION restore_account_after_remediation(
    p_user_id UUID,
    p_violation_category TEXT,
    p_score NUMERIC(5, 2)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_strikes INTEGER;
BEGIN
    SELECT active_moderation_strikes INTO v_strikes
    FROM user_preferences
    WHERE user_id = p_user_id;

    -- Record attempt
    INSERT INTO moderation_quiz_attempts (user_id, violation_category, score_percentage, passed)
    VALUES (p_user_id, p_violation_category, p_score, (p_score = 100.00));

    IF p_score = 100.00 THEN
        IF v_strikes >= 1 THEN
            -- Second violation -> Permanent Ban
            UPDATE user_preferences
            SET moderation_status = 'permanently_banned',
                is_banned = TRUE,
                updated_at = NOW()
            WHERE user_id = p_user_id;
            RETURN FALSE;
        ELSE
            -- First violation remediated -> Reinstate with 1 strike
            UPDATE user_preferences
            SET moderation_status = 'active',
                active_moderation_strikes = 1,
                updated_at = NOW()
            WHERE user_id = p_user_id;
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;