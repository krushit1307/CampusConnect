-- Migration for Facial Recognition Integration (Issue #4058)

DO $$ BEGIN
    CREATE TYPE face_tag_status AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Biometric Consent Matrix
-- We must store strict opt-in/opt-out status for GDPR/CCPA compliance
CREATE TABLE IF NOT EXISTS biometric_consent_profiles (
    user_id UUID PRIMARY KEY, -- Maps to auth.users
    has_consented BOOLEAN NOT NULL DEFAULT FALSE,
    reference_face_s3_key TEXT,
    aws_rekognition_face_id TEXT,
    consent_signature TEXT,
    consented_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Event Photos (Assuming it already exists or creating abbreviated version)
CREATE TABLE IF NOT EXISTS event_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    club_id UUID NOT NULL,
    storage_url TEXT NOT NULL,
    blurhash TEXT,
    is_processed_by_ai BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evt_pho_ev ON event_photos(event_id);

-- 3. Automatic Photo Tags
CREATE TABLE IF NOT EXISTS photo_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES event_photos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- The user found in the photo
    bounding_box_json JSONB, -- { Top, Left, Width, Height } from AWS
    confidence_score DECIMAL(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),
    status face_tag_status DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(photo_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pho_tag_usr ON photo_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_pho_tag_pho ON photo_tags(photo_id);

-- 4. RLS Policies
ALTER TABLE biometric_consent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_tags ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own biometric consent profile
CREATE POLICY "Users can manage their own biometric profile" ON biometric_consent_profiles
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Photos are generally readable
CREATE POLICY "Public photos are readable" ON event_photos
    FOR SELECT
    USING (true);

-- Users can only see tags belonging to themselves, and admins can see all
CREATE POLICY "Users can read their own tags" ON photo_tags
    FOR SELECT
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Service workers can write tags" ON photo_tags
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service workers can update tags" ON photo_tags
    FOR UPDATE
    USING (auth.role() = 'service_role' OR auth.uid() = user_id);

-- Functions and Triggers
CREATE OR REPLACE FUNCTION update_biometric_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_biometric_upd
BEFORE UPDATE ON biometric_consent_profiles
FOR EACH ROW
EXECUTE FUNCTION update_biometric_updated_at();

-- Dummy data to pad testing
INSERT INTO event_photos (id, event_id, club_id, storage_url, is_processed_by_ai)
VALUES 
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'https://example.com/photo1.jpg', true),
('11111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'https://example.com/photo2.jpg', true)
ON CONFLICT (id) DO NOTHING;
