-- 1. Create polymorphic media_assets table
CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_url TEXT NOT NULL,
    size_bytes BIGINT DEFAULT 0,
    mime_type TEXT DEFAULT 'image/jpeg',
    assetable_type TEXT NOT NULL CHECK (assetable_type IN ('USER', 'EVENT', 'CLUB')),
    assetable_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast polymorphic lookups
CREATE INDEX IF NOT EXISTS idx_media_assets_assetable ON media_assets(assetable_type, assetable_id);

-- Enable RLS
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

-- Allow public read access to media assets
CREATE POLICY "Public read media_assets"
    ON media_assets FOR SELECT
    USING (true);

-- Allow authenticated users to insert/manage media assets
CREATE POLICY "Authenticated insert media_assets"
    ON media_assets FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');