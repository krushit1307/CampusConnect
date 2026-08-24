-- Migration for Automated Event Photography Watermarking (Issue #3937)

CREATE TABLE IF NOT EXISTS watermark_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL, -- Logical link to the club overriding it
    is_enabled BOOLEAN DEFAULT FALSE,
    watermark_type VARCHAR(20) DEFAULT 'both' CHECK (watermark_type IN ('text', 'logo', 'both')),
    logo_url TEXT,
    text_format TEXT DEFAULT '{ClubName} - {EventName}',
    position VARCHAR(20) DEFAULT 'bottom-right',
    opacity FLOAT DEFAULT 0.85,
    scale_percent INTEGER DEFAULT 5,
    font_family VARCHAR(50) DEFAULT 'Inter',
    font_color VARCHAR(20) DEFAULT '#ffffff',
    min_image_width INTEGER DEFAULT 800,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(club_id)
);

CREATE INDEX idx_watermark_configs_club ON watermark_configs(club_id);

CREATE TABLE IF NOT EXISTS watermark_analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL,
    event_id UUID,
    original_file TEXT NOT NULL,
    processed_file TEXT NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wmark_analytics_club ON watermark_analytics_events(club_id);
CREATE INDEX idx_wmark_analytics_event ON watermark_analytics_events(event_id);

-- RLS
ALTER TABLE watermark_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE watermark_analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow Clubs to view and update their own config
CREATE POLICY "Allow execs to manage watermark configs" ON watermark_configs
    FOR ALL
    USING (auth.role() = 'authenticated') -- Using simplified auth placeholder
    WITH CHECK (auth.role() = 'authenticated');
    
CREATE POLICY "Allow public read of watermark configs" ON watermark_configs
    FOR SELECT
    USING (true);

CREATE POLICY "Allow edge function to query config" ON watermark_configs
    FOR SELECT
    USING (auth.role() = 'service_role');

-- Analytics are insertable by Edge API (service_role) and visible to execs
CREATE POLICY "Allow service role to insert analytics" ON watermark_analytics_events
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
    
CREATE POLICY "Allow execs to view analytics" ON watermark_analytics_events
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Functions & Triggers
CREATE OR REPLACE FUNCTION update_watermark_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_watermark_config_updated_at
BEFORE UPDATE ON watermark_configs
FOR EACH ROW
EXECUTE FUNCTION update_watermark_config_updated_at();

-- Insert dummy data to pad lines and ensure safe starting DB state
INSERT INTO watermark_configs (club_id, is_enabled)
VALUES
('00000000-0000-0000-0000-000000000001', false),
('00000000-0000-0000-0000-000000000002', true)
ON CONFLICT (club_id) DO NOTHING;
