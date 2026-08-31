-- 1. Add allow_explicit_music setting to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS allow_explicit_music BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Create event_playlist_tracks table for collaborative event soundtrack
CREATE TABLE IF NOT EXISTS event_playlist_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    requested_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    spotify_track_id TEXT NOT NULL,
    track_name TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    is_explicit BOOLEAN DEFAULT FALSE NOT NULL,
    status TEXT DEFAULT 'queued' NOT NULL CHECK (status IN ('queued', 'playing', 'played', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for live soundtrack feeds
CREATE INDEX IF NOT EXISTS idx_playlist_event_status ON event_playlist_tracks(event_id, status);

-- Enable RLS
ALTER TABLE event_playlist_tracks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Checked-in attendees can view queued tracks and request clean music
CREATE POLICY "Attendees can view event playlist"
    ON event_playlist_tracks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM rsvps r
            WHERE r.event_id = event_playlist_tracks.event_id
              AND r.user_id = auth.uid()
              AND r.status IN ('attending', 'attended')
        )
    );