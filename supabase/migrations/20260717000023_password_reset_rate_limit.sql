CREATE TABLE IF NOT EXISTS password_reset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_email
ON password_reset_requests(email);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_requested_at
ON password_reset_requests(requested_at);