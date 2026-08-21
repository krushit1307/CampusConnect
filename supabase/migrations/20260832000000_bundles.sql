-- Create bundles table
CREATE TABLE IF NOT EXISTS bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create bundle_items table
CREATE TABLE IF NOT EXISTS bundle_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id UUID NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    allocation_amount NUMERIC(10,2) NOT NULL
);

-- RLS
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;

-- Policies for bundles
CREATE POLICY "Bundles are viewable by everyone" ON bundles FOR SELECT USING (active = true);
CREATE POLICY "Admins can manage bundles" ON bundles FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM rbac_role_assignments WHERE role_id IN (SELECT id FROM rbac_roles WHERE name = 'System Admin'))
);

-- Policies for bundle_items
CREATE POLICY "Bundle items are viewable by everyone" ON bundle_items FOR SELECT USING (true);
CREATE POLICY "Admins can manage bundle items" ON bundle_items FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM rbac_role_assignments WHERE role_id IN (SELECT id FROM rbac_roles WHERE name = 'System Admin'))
);

-- Validate allocation totals via trigger
CREATE OR REPLACE FUNCTION check_bundle_allocations()
RETURNS TRIGGER AS $$
DECLARE
    total_allocation NUMERIC(10,2);
    bundle_price NUMERIC(10,2);
BEGIN
    SELECT COALESCE(SUM(allocation_amount), 0) INTO total_allocation
    FROM bundle_items
    WHERE bundle_id = NEW.bundle_id;

    SELECT price INTO bundle_price
    FROM bundles
    WHERE id = NEW.bundle_id;

    IF total_allocation > bundle_price THEN
        RAISE EXCEPTION 'Total allocation (%) exceeds bundle price (%)', total_allocation, bundle_price;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_bundle_allocation
AFTER INSERT OR UPDATE ON bundle_items
FOR EACH ROW
EXECUTE FUNCTION check_bundle_allocations();
