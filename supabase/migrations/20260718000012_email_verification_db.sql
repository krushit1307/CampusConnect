CREATE TABLE IF NOT EXISTS email_verifications(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
)