-- Create user_authenticators table for FIDO2 WebAuthn passkey storage
CREATE TABLE IF NOT EXISTS user_authenticators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    counter BIGINT DEFAULT 0 NOT NULL,
    transports TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast user credential lookups
CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON user_authenticators(user_id);

-- Enable RLS
ALTER TABLE user_authenticators ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own registered passkeys
CREATE POLICY "Users can manage own authenticators"
    ON user_authenticators FOR ALL
    USING (auth.uid() = user_id);