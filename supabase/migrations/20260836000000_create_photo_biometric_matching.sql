-- 1. Create user_biometric_consent table for GDPR/BIPA biometric compliance
CREATE TABLE IF NOT EXISTS user_biometric_consent (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    has_opted_in BOOLEAN DEFAULT FALSE NOT NULL,
    reference_selfie_url TEXT,
    consented_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create photo_face_matches table linking users to specific gallery photos
CREATE TABLE IF NOT EXISTS photo_face_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gallery_image_id UUID NOT NULL REFERENCES gallery_images(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    confidence_score NUMERIC(5,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(gallery_image_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_photo_matches_user ON photo_face_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_matches_image ON photo_face_matches(gallery_image_id);

-- Enable RLS
ALTER TABLE user_biometric_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_face_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own biometric consent"
    ON user_biometric_consent FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their matched event photos"
    ON photo_face_matches FOR SELECT
    USING (auth.uid() = user_id);