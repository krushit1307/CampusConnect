-- 1. Create default tenant record if it doesn't exist
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Seed primary university tenant
INSERT INTO tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Primary University', 'primary')
ON CONFLICT (slug) DO NOTHING;

-- 2. Add tenant_id column to core tables
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL;

-- Indexes for fast tenant scoping
CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clubs_tenant ON clubs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_tenant ON rsvps(tenant_id);

-- 3. SQL helper function for checking tenant match against JWT claims
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  );
END;
$$ LANGUAGE plpgsql STABLE;