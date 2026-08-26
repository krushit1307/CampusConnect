-- 1. Create gallery_images table
CREATE TABLE IF NOT EXISTS gallery_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create gallery_image_tags table
CREATE TABLE IF NOT EXISTS gallery_image_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID NOT NULL REFERENCES gallery_images(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    confidence NUMERIC(4,3) NOT NULL, -- Confidence score e.g. 0.950
    is_manual BOOLEAN DEFAULT FALSE NOT NULL, -- True if admin manually added/edited tag
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(image_id, tag)
);

-- Indexes for rapid tag filtering
CREATE INDEX IF NOT EXISTS idx_gallery_images_event ON gallery_images(event_id);
CREATE INDEX IF NOT EXISTS idx_gallery_image_tags_tag ON gallery_image_tags(tag);

-- Enable RLS
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_image_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view gallery images" ON gallery_images FOR SELECT USING (true);
CREATE POLICY "Public can view image tags" ON gallery_image_tags FOR SELECT USING (true);