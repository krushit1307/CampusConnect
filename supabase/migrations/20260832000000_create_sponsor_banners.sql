-- Create sponsor_banners table
CREATE TABLE IF NOT EXISTS sponsor_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    sponsor_name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    target_url TEXT NOT NULL,
    impressions BIGINT DEFAULT 0 NOT NULL,
    clicks BIGINT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast lookup by event
CREATE INDEX IF NOT EXISTS idx_sponsor_banners_event ON sponsor_banners(event_id);

-- Atomic SQL procedures to increment metrics
CREATE OR REPLACE FUNCTION increment_banner_impressions(p_banner_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE sponsor_banners
    SET impressions = impressions + 1
    WHERE id = p_banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_banner_clicks(p_banner_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE sponsor_banners
    SET clicks = clicks + 1
    WHERE id = p_banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;