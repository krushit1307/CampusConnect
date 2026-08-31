-- Migration: Geotargeted Sponsor Pricing & SVG Asset Overlays
-- Stores sponsor campaign pricing configurations, base currencies, and live exchange rate cache.

CREATE TABLE IF NOT EXISTS sponsor_pricing_assets (
    id VARCHAR(128) PRIMARY KEY,
    sponsor_name VARCHAR(255) NOT NULL,
    campaign_title VARCHAR(255) NOT NULL,
    logo_url TEXT NOT NULL,
    target_url TEXT NOT NULL,
    base_price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    promo_badge_text VARCHAR(128) DEFAULT 'Campus Deal',
    tier VARCHAR(64) NOT NULL DEFAULT 'partner',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sponsor_forex_rates (
    currency_code VARCHAR(8) PRIMARY KEY,
    currency_symbol VARCHAR(8) NOT NULL,
    usd_multiplier NUMERIC(12, 6) NOT NULL DEFAULT 1.000000,
    last_fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sponsor_geo_conversion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_asset_id VARCHAR(128) REFERENCES sponsor_pricing_assets(id),
    client_ip VARCHAR(64) NOT NULL,
    country_code VARCHAR(8) NOT NULL,
    local_currency_code VARCHAR(8) NOT NULL,
    localized_price NUMERIC(10, 2) NOT NULL,
    converted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsor_pricing_active ON sponsor_pricing_assets(is_active, tier);
CREATE INDEX IF NOT EXISTS idx_sponsor_geo_logs ON sponsor_geo_conversion_logs(sponsor_asset_id, country_code);
