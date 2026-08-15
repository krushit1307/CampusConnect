-- 1. Add audio support to events
ALTER TABLE events
ADD COLUMN IF NOT EXISTS audio_recording_url TEXT,
ADD COLUMN IF NOT EXISTS audio_duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS audio_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS audio_uploaded_by UUID REFERENCES profiles(id);

-- 2. Create event_audio_listens table
CREATE TABLE IF NOT EXISTS event_audio_listens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    listened_seconds INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint to prevent multiple listen rows per user per event
ALTER TABLE event_audio_listens ADD CONSTRAINT unique_user_event_listen UNIQUE (event_id, user_id);

CREATE INDEX IF NOT EXISTS idx_audio_listens_event ON event_audio_listens(event_id);
CREATE INDEX IF NOT EXISTS idx_audio_listens_user ON event_audio_listens(user_id);

-- Enable RLS on listens table
ALTER TABLE event_audio_listens ENABLE ROW LEVEL SECURITY;

-- 3. Storage Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('event_audio', 'event_audio', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage RLS Policies
-- Only event organizers can upload
CREATE POLICY "Organizers can upload audio"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'event_audio' AND
    EXISTS (
        SELECT 1 FROM events e
        JOIN club_members cm ON cm.club_id = e.club_id
        WHERE e.id::text = (string_to_array(name, '/'))[1]
        AND cm.user_id = auth.uid()
        AND cm.role IN ('president', 'vice_president', 'treasurer', 'secretary', 'admin')
    )
);

-- Authenticated users can stream approved recordings
CREATE POLICY "Authenticated users can stream audio"
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'event_audio' AND
    auth.role() = 'authenticated'
);

-- 5. Listens Table RLS
-- Users can insert and update their own listen records
CREATE POLICY "Users can manage their own listens"
ON event_audio_listens
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Event organizers can read all listens for their events
CREATE POLICY "Organizers can view event listens"
ON event_audio_listens
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM events e
        JOIN club_members cm ON cm.club_id = e.club_id
        WHERE e.id = event_audio_listens.event_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('president', 'vice_president', 'treasurer', 'secretary', 'admin')
    )
);
