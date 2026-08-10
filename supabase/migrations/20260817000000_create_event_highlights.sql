-- Create event_highlights table for 24-hour ephemeral stories
CREATE TABLE IF NOT EXISTS event_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT DEFAULT 'image' NOT NULL CHECK (media_type IN ('image', 'video')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours') NOT NULL
);

-- Index on expires_at for efficient cleanup and filtering queries
CREATE INDEX IF NOT EXISTS idx_event_highlights_expires ON event_highlights(expires_at);

-- Enable RLS
ALTER TABLE event_highlights ENABLE ROW LEVEL SECURITY;

-- Allow public read access only for unexpired stories
CREATE POLICY "Public can view active unexpired highlights"
    ON event_highlights FOR SELECT
    USING (expires_at > NOW());