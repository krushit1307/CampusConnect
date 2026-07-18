CREATE TABLE password_reset_logs(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ip_address TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE password_reset_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restrict access to system admins only" 
ON password_reset_logs
TO service_role
USING (true);