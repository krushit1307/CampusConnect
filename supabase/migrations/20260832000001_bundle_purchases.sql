-- Create bundle_purchases table
CREATE TABLE IF NOT EXISTS bundle_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    stripe_session_id TEXT UNIQUE,
    amount_paid NUMERIC(10,2),
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bundle_audit_log
CREATE TABLE IF NOT EXISTS bundle_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    bundle_id UUID REFERENCES bundles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE bundle_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view their own bundle purchases" ON bundle_purchases FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can manage all bundle purchases" ON bundle_purchases FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM rbac_role_assignments WHERE role_id IN (SELECT id FROM rbac_roles WHERE name = 'System Admin'))
);

-- Audit logs are admin only
CREATE POLICY "Admins can view bundle audit logs" ON bundle_audit_log FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM rbac_role_assignments WHERE role_id IN (SELECT id FROM rbac_roles WHERE name = 'System Admin'))
);
