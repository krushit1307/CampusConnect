-- 1. Create sponsors table
CREATE TABLE IF NOT EXISTS sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    logo_url TEXT,
    contact_email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Link sponsors to events with sponsorship tier/amount
CREATE TABLE IF NOT EXISTS event_sponsorships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    sponsorship_amount NUMERIC(10,2) NOT NULL CHECK (sponsorship_amount >= 0),
    tier TEXT DEFAULT 'Gold' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(sponsor_id, event_id)
);

-- 3. Track specific marketing assets (logo placements, swag bag links)
CREATE TABLE IF NOT EXISTS sponsorship_marketing_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsorship_id UUID NOT NULL REFERENCES event_sponsorships(id) ON DELETE CASCADE,
    asset_name TEXT NOT NULL, -- e.g., 'Virtual Swag Bag Promo Code'
    asset_type TEXT NOT NULL CHECK (asset_type IN ('logo_placement', 'swag_link', 'banner')),
    target_url TEXT,
    impressions BIGINT DEFAULT 0 NOT NULL,
    clicks BIGINT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for rapid analytics aggregation
CREATE INDEX IF NOT EXISTS idx_event_sponsorships_sponsor ON event_sponsorships(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_sponsorship ON sponsorship_marketing_assets(sponsorship_id);

-- Enable RLS
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsorship_marketing_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sponsors can view their own data"
    ON sponsors FOR SELECT
    USING (auth.jwt() ->> 'email' = contact_email);