-- 1. Create event_vendors table for digital storefronts
CREATE TABLE IF NOT EXISTS event_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    website_url TEXT,
    logo_url TEXT,
    booth_number TEXT,
    setup_token TEXT UNIQUE DEFAULT gen_random_uuid()::text NOT NULL,
    approval_status TEXT DEFAULT 'PENDING' NOT NULL CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create vendor_catalog table for vendor items/products
CREATE TABLE IF NOT EXISTS vendor_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES event_vendors(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    description TEXT,
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_vendors_event ON event_vendors(event_id);
CREATE INDEX IF NOT EXISTS idx_event_vendors_token ON event_vendors(setup_token);
CREATE INDEX IF NOT EXISTS idx_vendor_catalog_vendor ON vendor_catalog(vendor_id);

-- Enable RLS
ALTER TABLE event_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved vendors" ON event_vendors FOR SELECT USING (approval_status = 'APPROVED');
CREATE POLICY "Anyone can view vendor catalog" ON vendor_catalog FOR SELECT USING (true);