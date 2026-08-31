-- 1. Create user_privacy_consents table to log GDPR consent preferences
CREATE TABLE IF NOT EXISTS user_privacy_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    essential_granted BOOLEAN DEFAULT TRUE NOT NULL,
    analytics_granted BOOLEAN DEFAULT FALSE NOT NULL,
    marketing_granted BOOLEAN DEFAULT FALSE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_user_privacy_consent UNIQUE(user_id)
);

-- Index for fast consent verification
CREATE INDEX IF NOT EXISTS idx_privacy_consent_user ON user_privacy_consents(user_id);

-- Enable RLS
ALTER TABLE user_privacy_consents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view and manage their own privacy consents
CREATE POLICY "Users can manage their privacy consents"
    ON user_privacy_consents FOR ALL
    USING (auth.uid() = user_id OR user_id IS NULL);

-- 2. Stored RPC procedure to record or update granular cookie consents
CREATE OR REPLACE FUNCTION update_user_cookie_consent(
    p_user_id UUID,
    p_analytics BOOLEAN,
    p_marketing BOOLEAN,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
    consent_id UUID,
    essential BOOLEAN,
    analytics BOOLEAN,
    marketing BOOLEAN,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_consent_id UUID;
    v_updated_at TIMESTAMPTZ;
BEGIN
    INSERT INTO user_privacy_consents (
        user_id,
        essential_granted,
        analytics_granted,
        marketing_granted,
        ip_address,
        user_agent
    )
    VALUES (
        p_user_id,
        TRUE,
        p_analytics,
        p_marketing,
        p_ip_address,
        p_user_agent
    )
    ON CONFLICT (user_id) DO UPDATE
    SET analytics_granted = EXCLUDED.analytics_granted,
        marketing_granted = EXCLUDED.marketing_granted,
        ip_address = EXCLUDED.ip_address,
        user_agent = EXCLUDED.user_agent,
        updated_at = NOW()
    RETURNING id, updated_at INTO v_consent_id, v_updated_at;

    RETURN QUERY SELECT v_consent_id, TRUE, p_analytics, p_marketing, v_updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;