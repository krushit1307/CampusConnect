CREATE TABLE IF NOT EXISTS password_reset_logs(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ip_address TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE password_reset_logs ENABLE ROW LEVEL SECURITY;

-- 1. Allow the backend server to create new logs (Append-only)
DROP POLICY IF EXISTS "Allow backend to insert logs" ON password_reset_logs;
CREATE POLICY "Allow backend to insert logs" 
ON password_reset_logs
FOR INSERT 
TO service_role
WITH CHECK (true);

-- 2. Allow human system admins to read the logs
DROP POLICY IF EXISTS "Allow admins to read logs" ON password_reset_logs;
CREATE POLICY "Allow admins to read logs" 
ON password_reset_logs
FOR SELECT 
TO authenticated
USING (public.is_system_admin());
