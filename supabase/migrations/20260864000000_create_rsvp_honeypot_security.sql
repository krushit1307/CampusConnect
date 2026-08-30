-- 1. Create table to store banned IP addresses and blacklisted email domains trapped by honeypot
CREATE TABLE IF NOT EXISTS security_banned_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT,
    email_domain TEXT,
    reason TEXT DEFAULT 'Honeypot ticket tier triggered' NOT NULL,
    banned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ
);

-- Indexes for rapid lookup during RSVP form submission
CREATE INDEX IF NOT EXISTS idx_banned_ip ON security_banned_entities(ip_address);
CREATE INDEX IF NOT EXISTS idx_banned_domain ON security_banned_entities(email_domain);

-- Enable RLS
ALTER TABLE security_banned_entities ENABLE ROW LEVEL SECURITY;

-- 2. Stored procedure to handle honeypot trigger execution
CREATE OR REPLACE FUNCTION trigger_rsvp_honeypot_ban(
    p_ip_address TEXT,
    p_user_email TEXT,
    p_event_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_domain TEXT;
BEGIN
    v_domain := lower(split_part(p_user_email, '@', 2));

    -- Insert IP ban record (30-day default ban duration)
    INSERT INTO security_banned_entities (ip_address, email_domain, reason, expires_at)
    VALUES (p_ip_address, v_domain, 'Bot caught selecting hidden_admin_pass honeypot tier', NOW() + INTERVAL '30 days');

    -- Flag user account as suspicious/banned in user preferences
    UPDATE user_preferences
    SET is_banned = TRUE
    WHERE user_id IN (SELECT id FROM auth.users WHERE email = p_user_email);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;