-- 1. Create sponsorship_tiers table
CREATE TABLE IF NOT EXISTS sponsorship_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    tier_name TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents > 0),
    benefits TEXT[] DEFAULT '{}'::text[] NOT NULL,
    max_available INTEGER,
    purchased_count INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create corporate_sponsorships table
CREATE TABLE IF NOT EXISTS corporate_sponsorships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES sponsorship_tiers(id) ON DELETE RESTRICT,
    company_name TEXT NOT NULL,
    company_logo_url TEXT NOT NULL,
    company_website_url TEXT,
    stripe_payment_intent_id TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'refunded', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for storefront queries
CREATE INDEX IF NOT EXISTS idx_sponsorship_tiers_club ON sponsorship_tiers(club_id, is_active);
CREATE INDEX IF NOT EXISTS idx_corporate_sponsorships_club ON corporate_sponsorships(club_id, status);

-- Enable RLS
ALTER TABLE sponsorship_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_sponsorships ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can view active sponsorship tiers"
    ON sponsorship_tiers FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "Club officers can manage sponsorship tiers"
    ON sponsorship_tiers FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM club_memberships cm
            WHERE cm.club_id = sponsorship_tiers.club_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('president', 'treasurer', 'officer', 'admin')
        )
    );

-- Stored procedure to automatically attach sponsor logo to all upcoming club events upon verified purchase
CREATE OR REPLACE FUNCTION process_sponsorship_webhook_fulfillment(
    p_club_id UUID,
    p_tier_id UUID,
    p_company_name TEXT,
    p_company_logo_url TEXT,
    p_company_website_url TEXT,
    p_stripe_intent_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert corporate sponsorship record
    INSERT INTO corporate_sponsorships (
        club_id, tier_id, company_name, company_logo_url, company_website_url, stripe_payment_intent_id
    ) VALUES (
        p_club_id, p_tier_id, p_company_name, p_company_logo_url, p_company_website_url, p_stripe_intent_id
    );

    -- Increment tier purchase count
    UPDATE sponsorship_tiers
    SET purchased_count = purchased_count + 1,
        updated_at = NOW()
    WHERE id = p_tier_id;

    -- Automatically attach sponsor logo to upcoming club events
    UPDATE events
    SET sponsor_logos = ARRAY_APPEND(COALESCE(sponsor_logos, '{}'::text[]), p_company_logo_url)
    WHERE club_id = p_club_id
      AND start_time >= NOW();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;